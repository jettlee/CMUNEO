Galaxy = window.Galaxy || {};

Galaxy.Utils = function(settings) {
  _.bindAll(this, 'createGalaxyBackgroundMaterial');

  this.settings = settings;
  this.whiteColor = new THREE.Color( 0xffffff );

  this.particleSystem = null;
  this.projectData = null;
};

Galaxy.Utils.prototype = {

  rnd_snd : function() {
          return (Math.random()*2-1)+(Math.random()*2-1)+(Math.random()*2-1);
      },

  random : function(mean, stdev) {
      return Galaxy.Utilities.rnd_snd()*stdev+mean;
  },

  vertexAppearanceByViews : function(viewcount){ // using view count to decide brightness
      var prominence = (Math.pow(Math.log(viewcount),3))/(1000);
      return {
          size: prominence*9,
          ca: Galaxy.Utilities.whiteColor,
          alpha: Math.min(0.15 + 0.3*prominence,0.9)
      }
  },

  worldPointsFromIbleIds: function(ibleIds){
      var that = this;
      return _.map(ibleIds,function(id){
          var particleSystem = that.particleSystemForProjectid(id);
          var pointLocalCoords = that.vertexForProjectId(id,particleSystem).clone();
          pointLocalCoords.instructableId = id;
          return particleSystem.localToWorld(pointLocalCoords);
      });
  },

  particleSystemForProjectid: function(projectId){
        var ringIndex = _.indexOf(this.settings.categories,this.projectData[projectId]['category']);

        if (ringIndex === -1) {
            if (!_.isUndefined(console)) {
                //console.warn("Something went wrong. We couldn't find the project you had in mind.");
                return undefined;
            }
            return;
        }

        return this.particleSystems[ringIndex];
    },

    vertexForProjectId: function(projectId, particleSystem){
        var starIndex = this.projectData[projectId]['vertexNumber'];
        return particleSystem.geometry.vertices[starIndex];
    },

    vectorWorldToScreenXY : function(vector,camera){
        // vector assumed to be in world xyz coordinates coming in. Project to screen coordinates thus, for annotations:
        var widthHalf = window.Galaxy.Settings.width / 2,
            heightHalf = window.Galaxy.Settings.height / 2,
            projector = new THREE.Projector(),
            screenPosition;

        projector.projectVector( vector, camera );

        screenPosition = {
            x : ( vector.x * widthHalf ) + widthHalf,
            y : - ( vector.y * heightHalf ) + heightHalf
        };
        return screenPosition;
    },
    createGalaxyBackgroundMaterial: function(callback){
        var that = this, hex = "000000";

        // create destination canvas
        var canvasResult	= document.createElement('canvas');
        canvasResult.width	= 960;
        canvasResult.height	= 440;
        var contextResult	= canvasResult.getContext('2d');

        // load background image
        var imageMap	= new Image();
        imageMap.addEventListener("load", function() {

            // create dataMap ImageData for background image
            var canvasMap	= document.createElement('canvas');
            canvasMap.width	= imageMap.width;
            canvasMap.height= imageMap.height;
            var contextMap	= canvasMap.getContext('2d');

            contextMap.drawImage(imageMap, 0, 0);
            var dataMap	= contextMap.getImageData(0, 0, canvasMap.width, canvasMap.height);

            // this pixel is blessed: it will grow to become threejs's background color
            var p = contextMap.getImageData(90, 90, 1, 1).data;
            hex = ("000000" + that.rgbToHex(p[0], p[1], p[2])).slice(-6);

            // load transparency map
            var imageTrans	= new Image();
            imageTrans.addEventListener("load", function(){
                // create dataTrans ImageData for earthcloudmaptrans
                var canvasTrans		= document.createElement('canvas');
                canvasTrans.width	= imageTrans.width;
                canvasTrans.height	= imageTrans.height;
                var contextTrans	= canvasTrans.getContext('2d');
                contextTrans.drawImage(imageTrans, 0, 0);
                var dataTrans		= contextTrans.getImageData(0, 0, canvasTrans.width, canvasTrans.height);
                // merge dataMap + dataTrans into dataResult
                var dataResult		= contextMap.createImageData(canvasMap.width, canvasMap.height);
                for(var y = 0, offset = 0; y < imageMap.height; y++){
                    for(var x = 0; x < imageMap.width; x++, offset += 4){
                        dataResult.data[offset+0]	= dataMap.data[offset+0];
                        dataResult.data[offset+1]	= dataMap.data[offset+1];
                        dataResult.data[offset+2]	= dataMap.data[offset+2];
                        dataResult.data[offset+3]	= 255 - dataTrans.data[offset+0];
                    }
                }
                // update texture with result
                contextResult.putImageData(dataResult,0,0);
                material.map.needsUpdate = true;

                if (typeof callback === "function") callback(hex);
            });
            imageTrans.src	= "clouds/backgrounds/transparency.jpg";
        }, false);
        imageMap.src	= "clouds/backgrounds/"+Math.round(Math.random()*99)+".jpg";

        var material = new THREE.MeshBasicMaterial({
            map: new THREE.Texture(canvasResult),
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            side: THREE.DoubleSide
        });
        return {material: material};
    },

    rgbToHex: function(r, g, b) {
        if (r > 255 || g > 255 || b > 255)
            throw "Invalid color component";
        return ((r << 16) | (g << 8) | b).toString(16);
    }
};
