// IMPORTS
import * as THREE from "../threejs/three.module.js";
import * as ORBIT_CONTROLS from '../threejs/OrbitControls.js';
import * as MISC from '../common/misc.js';
import * as GUI from '../common/gui.js';
import * as BASE from "../common/base.js";
import * as SCENESTATE from "../common/scenestate.js";
import * as CONSTANTS from "../common/constants.js";
import * as SCENEACTION from "../common/sceneactions.js";
import * as LOADINGNOTE from "../common/loading.js";


// VARIABLES AND CONSTANTS

SCENESTATE.initializeDefaultConfiguration({
	"color_url" : [],
	"color_encoding" : "sRGB",

	"normal_url" : [],
	"normal_encoding" : "linear",
	"normal_scale" : 1.0,
	"normal_type" : "opengl",

	"displacement_url" : [],
	"displacement_encoding" : "linear",
	"displacement_scale" : 0.01,

	"roughness_url" : [],
	"roughness_encoding" : "linear",

	"metalness_url" : [],
	"metalness_encoding" : "linear",

	"ambientocclusion_url" : [],
	"ambientocclusion_encoding" : "linear",

	"opacity_url" : [],
	"opacity_encoding" : "linear",

	"environment_url" : ["./media/env-half-sunny-lq.exr"],
	"environment_index":0,
	"environment_name":[],

	"geometry_type" : "plane",
	"geometry_subdivisions" : 500,

	"tiling_scale" : 1,

	"material_index":0,
	"material_name":[],

	"clayrender_enable":0
});



// FUNCTIONS

var scene, camera, renderer, mesh, controls, textureLoader;

function updateScene(incomingSceneConfiguration,fallbackType){

	// Load configurations
	var oldSceneConfiguration = SCENESTATE.getCurrentConfiguration();
	var newSceneConfiguration = SCENESTATE.updateCurrentConfiguration(incomingSceneConfiguration,fallbackType);

	//console.debug("OLD",oldSceneConfiguration,"NEW",newSceneConfiguration);

	// Test for changes in url and encoding
	for(var mapName in CONSTANTS.mapNames){

		var oldMapUrlArray = MISC.toArray(oldSceneConfiguration[`${mapName}_url`]);
		var oldMapUrl = oldMapUrlArray[newSceneConfiguration['material_index']];

		var newMapUrlArray = MISC.toArray(newSceneConfiguration[`${mapName}_url`]);
		var newMapUrl = newMapUrlArray[newSceneConfiguration['material_index']];

		if(mapName == "color" && newSceneConfiguration.clayrender_enable){
			newMapUrl = null;
		}

		if( oldMapUrl != newMapUrl || (mapName == "color" && newSceneConfiguration.clayrender_enable != oldSceneConfiguration.clayrender_enable) ){
			if(newMapUrl){

				var loadingNote = new LOADINGNOTE.LoadingNote(MISC.filenameFromUrl(newMapUrl),newMapUrl);
				loadingNote.start();

				var texture = textureLoader.load(newMapUrl,function(texture,mapName){
					var ratio = texture.source.data.width / texture.source.data.height;
					if(ratio > 1){
						texture.repeat.set( parseFloat(newSceneConfiguration.tiling_scale), parseFloat(newSceneConfiguration.tiling_scale) * ratio );
					}else{
						texture.repeat.set( parseFloat(newSceneConfiguration.tiling_scale) / ratio, parseFloat(newSceneConfiguration.tiling_scale) );
					}
					texture.loadingNote.finish();
				});
				texture.loadingNote = loadingNote;
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.encoding = CONSTANTS.encoding[newSceneConfiguration[`${mapName}_encoding`]];
				
				// Apply additional settings to ensure that the maps actually have an effect
				// (like setting the object color to white to avoid a color tint on the texture)
				if(CONSTANTS.mapActiveSettings[mapName][0] != null){
					mesh.material[CONSTANTS.mapActiveSettings[mapName][0]] = CONSTANTS.mapActiveSettings[mapName][1];
				}

			}
			else{
				// Apply additional settings to ensure that the missing map is replaced with a sensible default
				if(CONSTANTS.mapActiveSettings[mapName][0] != null){
					mesh.material[CONSTANTS.mapInactiveSettings[mapName][0]] = CONSTANTS.mapInactiveSettings[mapName][1];
				}

				var texture = null;
			}

			mesh.material[CONSTANTS.mapNames[mapName]] = texture;
			mesh.material.needsUpdate = true;
		}

		if(oldSceneConfiguration.tiling_scale != newSceneConfiguration.tiling_scale){
			if(mesh.material[CONSTANTS.mapNames[mapName]] != null && mesh.material[CONSTANTS.mapNames[mapName]].source != null && mesh.material[CONSTANTS.mapNames[mapName]].source.data != null){
				var ratio = mesh.material[CONSTANTS.mapNames[mapName]].source.data.width / mesh.material[CONSTANTS.mapNames[mapName]].source.data.height;
				if(ratio > 1){
					mesh.material[CONSTANTS.mapNames[mapName]].repeat.set( parseFloat(newSceneConfiguration.tiling_scale), parseFloat(newSceneConfiguration.tiling_scale) * ratio );
				}else{
					mesh.material[CONSTANTS.mapNames[mapName]].repeat.set( parseFloat(newSceneConfiguration.tiling_scale) / ratio, parseFloat(newSceneConfiguration.tiling_scale) );
				}	
			}
		}
		
		if( oldSceneConfiguration[`${mapName}_encoding`] != newSceneConfiguration[`${mapName}_encoding`]){
			if(mesh.material[CONSTANTS.mapNames[mapName]] != null){
				mesh.material[CONSTANTS.mapNames[mapName]].encoding = CONSTANTS.encoding[newSceneConfiguration[`${mapName}_encoding`]];
			}
		}

	}

	// Set new geometry subdivisions and type
	if(oldSceneConfiguration["geometry_subdivisions"] != newSceneConfiguration["geometry_subdivisions"] || oldSceneConfiguration["geometry_type"] != newSceneConfiguration["geometry_type"]){
		switch (newSceneConfiguration["geometry_type"]) {
			case "cube":
				mesh.geometry = new THREE.BoxGeometry(1,1,1,newSceneConfiguration["geometry_subdivisions"],newSceneConfiguration["geometry_subdivisions"],newSceneConfiguration["geometry_subdivisions"]);
				break;
			case "cylinder":
				mesh.rotation.x = 0;
				mesh.geometry = new THREE.CylinderGeometry(0.5,0.5,1,newSceneConfiguration["geometry_subdivisions"],newSceneConfiguration["geometry_subdivisions"]);
				break;
			case "sphere":
				mesh.rotation.x = 0;
				mesh.geometry = new THREE.SphereGeometry(0.5,newSceneConfiguration["geometry_subdivisions"],newSceneConfiguration["geometry_subdivisions"]);
				break;
			case "plane":
			default:
				mesh.rotation.x = 0.75 * 2 * Math.PI;
				mesh.geometry = new THREE.PlaneGeometry(1,1,newSceneConfiguration["geometry_subdivisions"],newSceneConfiguration["geometry_subdivisions"]);
				break;
		}
	}

	// Test for changes in displacement strength

	if(oldSceneConfiguration["displacement_scale"] != newSceneConfiguration["displacement_scale"]){
		mesh.material.displacementBias = newSceneConfiguration["displacement_scale"] / -2;
		mesh.material.displacementScale = newSceneConfiguration["displacement_scale"];
	}

	// Set Environment

	if(oldSceneConfiguration.environment_index != newSceneConfiguration.environment_index || !MISC.arrayEquals(oldSceneConfiguration['environment_url'],newSceneConfiguration['environment_url'])){

		SCENEACTION.updateSceneEnvironment(newSceneConfiguration["environment_url"][newSceneConfiguration["environment_index"]],scene,renderer);
		
	}

	// Normal map type
	
	if(oldSceneConfiguration["normal_type"] != newSceneConfiguration["normal_type"] || oldSceneConfiguration["normal_scale"] != newSceneConfiguration["normal_scale"]){
		mesh.material.normalScale = new THREE.Vector2(newSceneConfiguration["normal_scale"],newSceneConfiguration["normal_scale"]).multiply(CONSTANTS.normalMapType[newSceneConfiguration["normal_type"]]);
	}
	

	GUI.updateGuiFromCurrentSceneConfiguration();
}

function initializeScene(){
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 1000 );
	camera.position.z = 2;
	camera.position.y = 1;

	renderer = new THREE.WebGLRenderer();
	renderer.toneMapping = CONSTANTS.toneMapping.filmic;
	renderer.outputEncoding = CONSTANTS.encoding.sRGB;

	BASE.resizeRenderingArea(camera,renderer);

	mesh = new THREE.Mesh( new THREE.PlaneGeometry(1,1,1,1), new THREE.MeshPhysicalMaterial() );
	mesh.material.transparent = true;
	scene.add(mesh);

	controls = new ORBIT_CONTROLS.OrbitControls(camera, renderer.domElement)
	controls.enableDamping = true;

	textureLoader = new THREE.TextureLoader();

	// Set up renderer
	document.querySelector('#renderer_target').appendChild( renderer.domElement );

	// Window resizing
	window.addEventListener('resize', (e) => { BASE.resizeRenderingArea(camera,renderer)}, false);

}

function animate() {
    requestAnimationFrame( animate );
	controls.update();
    renderer.render( scene, camera );
}

BASE.start(initializeScene,updateScene,animate);