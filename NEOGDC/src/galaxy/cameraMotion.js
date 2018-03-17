Galaxy.Settings = Galaxy.Settings || {};

Galaxy.CameraMotions = function(camera){
    _.bindAll(this,'startAnimation','endAnimation');
    this.target = Galaxy.Settings.cameraDefaultTarget.clone();
    this.camera = camera;

    // delete this property eventually
    this.firstClick = true;

    this.isAnimating = false;
}

Galaxy.CameraMotions.prototype = {
    constructor: Galaxy.CameraMotions,
    startAnimation: function(){
        // startAnimation refers to user-initiated animations. The default animation must be removed if ongoing.
        //this.endAutomaticTravel();
        this.isAnimating = true;
    },
    endAnimation: function(){this.isAnimating = false;},
    zoomAndDollyToPoint: function(point,callback){
        console.log("camera zoom in");
        if (this.isAnimating === true) return;
        // temporarily: the first click will zoom in, and we'll strafe after that.
        // if (this.firstClick === false) {
        //     //this.strafeFromPointToPoint(this.target,point,callback);
        //     this.zoomToFitPointsFrom([point],this.CAMERA_RELATION.TOWARD_CENTER,callback);
        //     return;
        // }
        this.firstClick = false;

        var that = this,
            pointClone = point.clone(),
            cameraPath = this.cameraPathToPoint(this.camera.position.clone(), point.clone()),
            currentPosition = {now: 0}, // relative position from 0 - 1, representing how far - close to the particle
            duration = 1.3,
            upClone = Galaxy.Settings.cameraDefaultUp.clone(),
            targetCurrent = this.target.clone();

        // center the clicked particle
        TweenMax.to(targetCurrent,duration/1.5,{
            x: pointClone.x,
            y: pointClone.y,
            z: pointClone.z
        });

        // dolly camera to the particular particle
        TweenMax.to(currentPosition,duration,{
            now:0.9, // relative position from 0 - 1, representing how far - close to the particle
            onUpdate: function(){ //moving camera
                var pos = cameraPath.getPoint(currentPosition.now);
                that.target = new THREE.Vector3(targetCurrent.x,targetCurrent.y,targetCurrent.z);
                that.camera.position.set(pos.x,pos.y,pos.z);
                that.camera.up.set(upClone.x,upClone.y,upClone.z);
                that.camera.lookAt(that.target);
                that.camera.updateProjectionMatrix(); //after making changes to most of these poperties you will have to call for the changes to take effect
            },
            onStart: that.startAnimation,
            onComplete: function(){
                that.endAnimation();
                if (typeof callback === "function") callback();
            }
        });
    },

    // fetch path of camera to point
    cameraPathToPoint: function(fromPoint,toPoint){
        // using splineCurve to create a smooth 2d spline curve for moving camera
        var spline = new THREE.SplineCurve3([
           fromPoint,
           new THREE.Vector3( (toPoint.x-fromPoint.x)*0.5 + fromPoint.x, (toPoint.y-fromPoint.y)*0.5 + fromPoint.y, (toPoint.z-fromPoint.z)*0.7 + fromPoint.z),
           toPoint
        ]);

        return spline;
    },

    strafeFromPointToPoint: function(fromPoint,toPoint,callback){
        var dest = toPoint.clone(),
            current = this.camera.position.clone(),
            duration = 0.5,
            that = this;
        dest.sub(fromPoint.clone());
        dest.add(current.clone());
        //console.log("\n\n",fromPoint,toPoint,current,dest);

        if (that.isAnimating === true) return;

        TweenMax.to(this.camera.position,duration,{x: dest.x,y: dest.y, z: dest.z,
            onComplete: function(){
                that.endAnimation();
                that.camera.lookAt(toPoint.clone());
                that.target = toPoint.clone();
                if (typeof callback === "function") callback();
            },
            onStart: that.startAnimation
        })
    },

    reset: function(callback){
        var duration = 5,
            that = this,
            home = Galaxy.Settings.cameraDefaultPosition.clone(),
            center = Galaxy.Settings.cameraDefaultTarget.clone(),
            upGoal = Galaxy.Settings.cameraDefaultUp.clone(),
            upCurrent = this.camera.up.clone(),
            targetCurrent = this.target.clone(),
            positionCurrent = this.camera.position.clone();

        // never do anything when nothing will suffice. The callback should have no delay.
        if (this.camera.up.equals(Galaxy.Settings.cameraDefaultUp) &&
            this.camera.position.equals(Galaxy.Settings.cameraDefaultPosition) &&
            this.target.equals(Galaxy.Settings.cameraDefaultTarget)) {

            duration = 0.1;
        }
        if (that.isAnimating === true) return;

        TweenMax.to(upCurrent,duration/1.5,{x: upGoal.x,y: upGoal.y,z: upGoal.z});
        TweenMax.to(targetCurrent,duration/1.5,{x: center.x,y: center.y, z: center.z});
        TweenMax.to(positionCurrent,duration,{x: home.x,y: home.y, z: home.z,ease: Power1.easeInOut,
            onUpdate: function(){
                that.target = new THREE.Vector3(targetCurrent.x,targetCurrent.y,targetCurrent.z);
                that.camera.position.set(positionCurrent.x,positionCurrent.y,positionCurrent.z);
                that.camera.up.set( upCurrent.x,upCurrent.y,upCurrent.z );
                that.camera.lookAt(that.target.clone());
                that.camera.updateProjectionMatrix();
            },
            onComplete: function(){
                that.endAnimation();
                that.firstClick = true;
                if (typeof callback === "function") callback();
            },
            onStart: that.startAnimation
        })
    },

    CAMERA_RELATION : {
        ABOVE: 0,
        SAME_ANGLE: 1,
        TOWARD_CENTER: 2
    },

//     zoomToFitPointsFrom: function(pointList,cameraRelation,callback) {
//         if (!_.has(_.values(this.CAMERA_RELATION),cameraRelation)) {
//             // console.log(_.values(this.CAMERA_RELATION));
//             console.error(cameraRelation + " is not one of RELATIVE_LOCATION");
//             return;
//         }
//         if (this.isAnimating === true) return;
//
//         // pointList assumed to already be in world coordinates. Figure out bounding sphere, then move camera relative to its center
//         var bSphere = new THREE.Sphere(new THREE.Vector3(0,0,0),5);
//         bSphere.setFromPoints(pointList);
//
//         // how far away do we need to be to fit this sphere?
//         var targetDistance = (bSphere.radius / (Math.tan(Math.PI*this.camera.fov/360))),
//             cameraPositionEnd,
//             that = this,
//             duration = 1,
//             up = this.camera.up.clone(),
//             currentCameraPosition = this.camera.position.clone();
//
//         switch (cameraRelation) {
//             case 0:
//                 // CAMERA_RELATION.ABOVE
//                 cameraPositionEnd = bSphere.center.clone().add(new THREE.Vector3(40,40,targetDistance));
//                 break;
//
//             case 1:
//                 // CAMERA_RELATION.SAME_ANGLE dollies the camera in/out such that these points become visible
//                 var center = bSphere.center.clone(),
//                     currentPos = that.camera.position.clone(),
//                     finalViewAngle = currentPos.sub(center).setLength(targetDistance);
//                 cameraPositionEnd = bSphere.center.clone().add(finalViewAngle);
//
//                 // to prevent camera from going under the background plane:
//                 cameraPositionEnd.z = Math.max(cameraPositionEnd.z,40);
//                 break;
//
//             case 2:
//                 // CAMERA_RELATION.TOWARD_CENTER Draws a line from world origin through the bounding sphere's center point,
//                 // and puts the camera at the end of a vector twice that length.
//                 cameraPositionEnd = bSphere.center.clone().multiplyScalar(2);
//                 if (cameraPositionEnd.length() < 125) cameraPositionEnd.setLength(125);  // It's weird when the camera gets too close to stars in the middle
//                 break;
//
//         }
//         var cameraTargetCurrent = {x: this.target.x, y: this.target.y, z: this.target.z};
//         var cameraTargetEnd = bSphere.center.clone();
//
// //        that.logVec('up',that.camera.up.clone());
// //        that.logVec('target',that.target.clone());
// //        that.logVec('position',that.camera.position.clone());
//         TweenMax.to(cameraTargetCurrent,duration/1.5,{x: cameraTargetEnd.x,y: cameraTargetEnd.y, z: cameraTargetEnd.z});
//
//         // DO NOT change "up" for  high angle. It gets screwy and spins the camera unpleasantly.
//         if (cameraRelation !== 0) {TweenMax.to(up,duration/1.5,{x: 0,y: 0, z: 1});}
//
//         TweenMax.to(currentCameraPosition,duration,{x: cameraPositionEnd.x,y: cameraPositionEnd.y, z: cameraPositionEnd.z,
//             onUpdate: function(){
//                 that.target = new THREE.Vector3(cameraTargetCurrent.x,cameraTargetCurrent.y,cameraTargetCurrent.z);
//                 that.camera.position.set(currentCameraPosition.x,currentCameraPosition.y,currentCameraPosition.z);
//                 that.camera.up.set( up.x,up.y,up.z );
//                 that.camera.lookAt(that.target.clone());
//                 that.camera.updateProjectionMatrix();
//             },
//             onComplete: function(){
// //                that.logVec('up',that.camera.up.clone());
// //                that.logVec('target',that.target.clone());
// //                that.logVec('position',that.camera.position.clone());
//                 that.endAnimation();
//                 if (typeof callback === "function") callback();
//             },
//             onStart: that.startAnimation
//         })
//     },

    // DEBUGGING TOOLS
    logVec: function(message,vec){
        console.log(message + ": " + vec.x + " " + vec.y + " " + vec.z);
    },
    addTestCubeAtPosition: function(position){
        var cube = new THREE.Mesh( new THREE.CubeGeometry( 5, 5, 5 ), new THREE.MeshNormalMaterial() );
        cube.position = position.clone();
        Galaxy.Scene.add( cube );
    }

}
