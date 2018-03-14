var planets = [];
var planets_data = [];

var planet_type = ['Sun','Mercury','Venus','Moon','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']

function addNewPlanet(planet_name){
  var mesh = THREEx.Planets.createSun();
  switch (planet_name) {
    case 'Sun':
      mesh = THREEx.Planets.createSun();
      break;
    case 'Mercury':
      mesh = THREEx.Planets.createMercury();
      break;
    case 'Venus':
      mesh = THREEx.Planets.createVenus();
      break;
    case 'Moon':
      mesh = THREEx.Planets.createMoon();
      break;
    case 'Mars':
      mesh = THREEx.Planets.createMars();
      break;
    case 'Jupiter':
      mesh = THREEx.Planets.createJupiter();
      break;
    case 'Saturn':
      mesh = THREEx.Planets.createSaturn();
      break;
    case 'Uranus':
      mesh = THREEx.Planets.createUranus();
      break;
    case 'Neptune':
      mesh = THREEx.Planets.createNeptune();
      break;
    case 'Pluto':
      mesh = THREEx.Planets.createPluto();
      break;
    default:
      mesh = THREEx.Planets.createSun();
  }
  var x = randomIntFromInterval(5,-5);
  var y = randomIntFromInterval(3,-3);
  var z = randomIntFromInterval(0,-5);
  mesh.position.set(x,y,z);
  return mesh;
}

function randomIntFromInterval(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
}

function createPlanets(number_of_planets) {
  for(var i=0;i<number_of_planets;i++){
    var planet_number = randomIntFromInterval(0,9);
    var mesh = addNewPlanet(planet_type[planet_number]);
    planets.push(mesh);
  }
  localStorage.setItem('planets',JSON.stringify(planets));
  return planets;
}
