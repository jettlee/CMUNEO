Galaxy.InteractionHandler = function (camera, particleSystemsArray){
    this.cameraMotions = new Galaxy.CameraMotions(camera);
    _.bindAll(this,'canvasClickEvent','selectVertex');
    _.bindAll(this,'showInstructable', 'getTagManager','resetInteractionTimer');

    // need status right away, in case we need to report something:
    //this.__statusIndicator = new window.GalaxyStatusIndicator();

    this.camera = camera;
    this.particleSystemsArray = particleSystemsArray;
    this.frozen = false;

    this.__interactionTimer = null;
    this.__constellation = null;
    this.__onscreenKeyboardView = null;

    var that = this;
    $('#three-canvas').on('click',this.canvasClickEvent);

    // Because of the confusing contexts, it's a little easier to do this than to handle each of the types of links properly
    $(document).on('click','a',{context: that},this.clickAnchor);

    //this.searchButton = new window.GalaxyToolbar();
    //this.searchButton.on("requestSearchKeyboard",this.initiateSearch);

    // instantiate tagManager
    this.__tagManager = new Galaxy.ProjectTagManager(particleSystemsArray,camera,Galaxy.Settings,Galaxy.Datasource);

    // generate initial tags
    _.delay(function(){that.getTagManager().maintainTagCount(5);},5000);

    // put event listener on a customized tag
    $(this.__tagManager).on('clickTag',function(e){
        that.resetInteractionTimer();
        that.clearProjectDescriptionLong(); // do this even if nothing else gets done
        if (that.cameraMotions.isAnimating === false) {
            that.showInstructable(e.instructableId);
        }
    });

    this.resetInteractionTimer();
}

Galaxy.InteractionHandler.prototype = {

    constructor: Galaxy.InteractionHandler,

    setFrozen: function(frozen){
        this.frozen = frozen;
        $(this).trigger({
            type: 'frozenStateChanged',
            frozen: true
        });
    },
    resetInteractionTimer: function(){
        if (!_.isNull(this.__interactionTimer)) clearTimeout(this.__interactionTimer);

        var that = this;
        this.__interactionTimer = setTimeout(function(){
            // user has been inactive. Reset the display
            that.reset({projectTagsClear: false, projectTagsAddAfterCameraReset: true},function(){
                //that.cameraMotions.beginAutomaticTravel();
            });
        },90000)
    },


    // Detect canvas click event and zoom in to a particle.
    // In GDC demo prototype, we prohibit the functionality of selecting a random vertex
    // Will implement click to neuroglancer here
    canvasClickEvent: function(e){

        e.preventDefault();
        e.stopPropagation();
        this.resetInteractionTimer();

        // prevent galaxy rotation
        //this.setFrozen(true);

        var vector = new THREE.Vector3( ( e.clientX / Galaxy.Settings.width ) * 2 - 1, - ( e.clientY / Galaxy.Settings.height ) * 2 + 1, 0.5 );
        var projector = new THREE.Projector();
        projector.unprojectVector( vector, this.camera );

        var ray = new THREE.Raycaster( this.camera.position, vector.sub( this.camera.position ).normalize() );

        // If there are already selected stars out in the field, ie, from an author constellation or related group,
        // we assume the user is trying to select one of those. However, if each of these systems contains
        // only a single vertex, that indicates the user may just be clicking around individually. So don't use pre-selected
        // stars for the intersection in that case.
        var intersectSystems = this.particleSystemsArray,
            that = this;
        if (!_.isUndefined(this.__glowingParticleSystems)) {
            _.each(this.__glowingParticleSystems,function(system){
                if (system.geometry.vertices.length !== 1) {
                    // intersec with the glowing systems instead
                    intersectSystems = that.__glowingParticleSystems;
                }
            });
        }

        // When the camera is very close to the star that's selected, distance is deceiving. We basically need to adjust hit tolerance based on the distance to camera
        // Calculate the distance camera --> star by converting star's position to world coords, then measuring
        // intersection.point = Vector3
        // intersection.object = ParticleSystem it's a part of
        var getCameraDistanceForHit = function(intersection){
            var intersectionVect = intersection.point.clone();
            intersectionVect = intersection.object.localToWorld(intersectionVect);
            return intersectionVect.distanceTo(that.camera.position.clone());
        };

        // intersects sorted by distance so the first item is the "best fit"
        var intersects = _.sortBy(ray.intersectObjects( intersectSystems, true ),function(intersection){
            return getCameraDistanceForHit(intersection) / intersection.distance;
        });

        // When a hit is too close to the camera for its hit tolerance, it doesn't count. Remove those values.
        intersects = _.filter(intersects, function(intersection){
            return getCameraDistanceForHit(intersection) / intersection.distance > 100;
        });

        if ( intersects.length > 0 ) {
            this.selectVertex(intersects[0])
        } else {
            // no intersections are within tolerance.
            this.reset({projectTagsAddAfterCameraReset: true});
        }
    },

    reset: function(thingsToReset, callback){
        // A default object will reset everything. Situations calling for a more nuanced reset can have that, too, by overriding defaults here.
        var resetSettings = {
            keyboard: true,
            sceneComposers: true,
            projectDescriptionLong: true,
            projectTagsAddAfterCameraReset: false,
            projectTagsClear: true,
            freezeMotion: false,
            glowingIbles: true,
            constellation: true,
            cameraMotions: true
        };
        // override any defaults
        thingsToReset = thingsToReset || {};
        _.extend(resetSettings,thingsToReset);

        // go about resetting things:
        var delay = 0;
        if (resetSettings.glowingIbles === true) this.clearGlowing();
        //if (resetSettings.constellation) this.clearConstellation();

        // big project descriptions take jquery a moment to unbind. If there's one showing, delay all the rest of the reset a tiny bit.
        if (resetSettings.projectDescriptionLong === true) delay = this.clearProjectDescriptionLong() === 0 ? 0 : 250;
        _.delay(_.bind(function(){
            if (!_.isNull(this.__onscreenKeyboardView) && resetSettings.keyboard === true) //this.__onscreenKeyboardView.closeModal();
            if (resetSettings.sceneComposers === true) Galaxy.Composers = Galaxy.ComposeScene();
            if (resetSettings.projectTagsClear === true) this.getTagManager().removeAllTags();
            this.setFrozen(resetSettings.freezeMotion);
            if (resetSettings.cameraMotions === true) {
                this.cameraMotions.reset(function(){
                    if (typeof callback === "function") callback();
                });
                var that = this;
                if (resetSettings.projectTagsAddAfterCameraReset === true) {
                    that.__tagManager.tagAnyProjects();
                    that.__tagManager.maintainTagCount(5);
                }
            } else {
                if (typeof callback === "function") callback();
            }
        },this),delay);
    },

    // when guest clicks a tag, this function will zoom in and show details
    showInstructable: function(projectId){
        this.setFrozen(true);

        // Glow selected vertex
        this.glowIbles([Galaxy.Datasource[projectId]]);

        var particleSystem = Galaxy.Utilities.particleSystemForProjectid(projectId);
        var point = Galaxy.Utilities.vertexForProjectId(projectId, particleSystem);

        var that = this,
            pointLocal = point.clone(),
            selectedPointWorldCoords = particleSystem.localToWorld(pointLocal);

        this.cameraMotions.zoomAndDollyToPoint(selectedPointWorldCoords,function(){
            var starLocation = Galaxy.Utilities.vectorWorldToScreenXY(pointLocal, that.camera);
            // can put detailed information here, cuz this is the callback function executed after zoom in
            that.placeProjectDescriptionLong(starLocation,projectId);
        });
    },

    selectVertex: function(vertex){
        // var that = this,
        //     // before we begin, make sure there's no active stuff on the screen yet.
        //     projDescriptionCount = this.clearProjectDescriptionLong(),
        //     pointLocal = vertex.point.clone(),
        //     selectedPointWorldCoords = vertex.object.localToWorld(pointLocal),
        //     delay = projDescriptionCount === 0 ? 0 : 350;  // delay camera zooming if a big project description needs to be removed
        //
        // _.delay(_.bind(function(){
        //     // If there's an active constellation, visible or not, it can tell us which neighboring points to show.
        //     // that.__constellation.getConnections(that.__constellation.connections[3][0]);
        //     if (!(_.isUndefined(this.__constellation) || _.isNull(this.__constellation))) {
        //         var neighbors = this.__constellation.getConnections(vertex.point.instructableId);
        //         if (neighbors.length > 0) {
        //             var pointList = Galaxy.Utilities.worldPointsFromIbleIds(_.union([vertex.point.instructableId],neighbors));
        //             // this.cameraMotions.showThreePointsNicely(pointList,function(){
        //             //     var starLocation = Galaxy.Utilities.vectorWorldToScreenXY(pointLocal, that.camera);
        //             //     that.placeProjectDescriptionLong(starLocation,vertex.point.instructableId);
        //             // });
        //         }
        //     } else {
        //         // When randomly selecting a point, it needs to glow:
        //         this.glowIbles([Galaxy.Datasource[vertex.point.instructableId]]);
        //
        //         // zoom in, there's nothing specific we want on screen
        //         this.cameraMotions.zoomAndDollyToPoint(selectedPointWorldCoords,function(){
        //             var starLocation = Galaxy.Utilities.vectorWorldToScreenXY(pointLocal, that.camera);
        //             that.placeProjectDescriptionLong(starLocation,vertex.point.instructableId);
        //         });
        //     }
        // },that),delay);
    },

    // this function is to add extra layer on top of the basic layer, which renders all particles
    // as a result, changing material here is to change what will be rendered after clicking
    glowIbles: function(ibleList){
        // if (!_.isNull(this.__onscreenKeyboardView)) this.__onscreenKeyboardView.closeModal();
        var particles = new THREE.Geometry();
        _.each(ibleList,function(ibleData){
            var vec = Galaxy.Utilities.worldPointsFromIbleIds([ibleData.id])[0];
            var vertex = new THREE.Vector3(vec.x,vec.y,vec.z);
            vertex.instructableId = ibleData.id;
            particles.vertices.push(vertex);
        });

        var pMaterial = new THREE.ParticleBasicMaterial({
            size: 100,
            map: THREE.ImageUtils.loadTexture("images/earth.jpg"),
            blending: THREE.AdditiveBlending,
            transparent: false,
            depthTest: false
        });

        // create the particle system
        var particleSystem = new THREE.ParticleSystem(
            particles,
            pMaterial);

        // var sun = makeSun(
        //     {
        //         radius: 7.35144e-8,
		// 		spectral: 0.656,
        //     }
        // )
        // add it to the scene
        this.__glowingParticleSystems = this.__glowingParticleSystems || [];
        this.__glowingParticleSystems.push(particleSystem);
        Galaxy.TopScene.add(particleSystem);
    },
    clearProjectDescriptionLong: function(){
        var el = $('div.threejs-project-anchor.project-description-long'),
            numberOfDescriptions = el.length;
        $('.slideshow').cycle('destroy');
        el.popover('destroy');
        el.remove();
        return numberOfDescriptions;
    },

    placeProjectDescriptionLong: function(screenLocation,projectId){
        var htmlElement = $("<div class='threejs-project-anchor project-description-long' id='project-"+projectId+"'></div>"),
        that = this;
        $('body').append(htmlElement);
    },

    clearGlowing: function(){
        _.each(this.__glowingParticleSystems, function(child){
            Galaxy.TopScene.remove(child);
        });
        delete this.__glowingParticleSystems;
    },

    getTagManager: function(){
        return this.__tagManager;
    },

};
