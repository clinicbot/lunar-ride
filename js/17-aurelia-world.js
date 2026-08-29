"use strict";

/* Aurelia Wilds is deliberately self-contained: it uses the proven epic
   route generator and does NOT add a shortcut or a second connecting road.
   The different seed and scene parameters generate a completely separate
   25 km landscape while keeping the stable single-route topology. */
SCENES.push({
  id:'aurelia',
  name:'Aurelia Wilds — Grand Tour',
  subtitle:'A 25 km living-world grand tour: lakeside meadows, deep forests, glowing flower fields, crystal country, futuristic settlements and a long alpine climb into frozen highlands before the descent home.',

  land:{amp:125, scale:620, rough:.55, craters:5, craterMax:125, rimAmp:520},
  road:{maxGrade:8, halfWidth:3.35, loopR:1380, twist:.72, tunnels:3, bridges:4, lapKm:25,
        epic:{boost:360, boostR:900, T:4.4, Td:4.0, rmin:115}},

  sun:{az:2.55, el:.58, col:'#fff0c8', amb:'#405469'},
  col:{high:'#879b63', low:'#365b43', road:'#3f4140', rumble:'#e7e0c2', lane:'#fff2ce'},

  /* Low basins become blue lakes; the high mountain changes to ice/frozen
     flora automatically because this is an epic route. */
  water:{q:0.115, col:'#287fa3'},
  snow:255,
  iceAbove:175,
  skyImg:'assets/images/sky_kepler.jpg',
  sky:{top:'#28456f', horizon:'#d69ab1', fog:'#91a7ba', fogDen:.00034,
       stars:0, starBright:0, cloud:.60, cloudCol:'#fff3ee',
       earth:{az:5.2, el:.28, size:.040}},

  /* The route repeatedly changes biome, Zwift-style, rather than looking
     identical for the whole 25 km. */
  zones:['meadow','forest','flower','grove','rocky','forest','meadow','flower','grove','rocky'],
  veg:{grass:24000, bush:1000, oaks:2200, pines:2600,
       tintA:'#397649', tintB:'#c4ae50'},
  flora:{spires:320, fans:520, tufts:1200, pods:340, crystals:220},

  /* Four procedural animal families, plus the existing glTF stags, cats,
     floating jellies, birds and dragonflies that the world builder places
     along every route. */
  fauna:{grazer:10, strider:8, hopper:10, drifter:8},

  /* Settlements, road equipment, stations/cities, rovers, ships and drones
     keep the route visually busy between the natural sections. */
  life:{bases:4, walkers:16, rovers:4, ships:4, drones:6, station:true, spaceport:true},

  bio:{stem:'#466f4f', leaf:'#5fa94e', glow:'#9dffcb', skin:'#a98a58',
       dark:'#29372d', accent:'#e06a47', eye:'#fff19a'},
  kit:{hull:'#d9ddd8',trim:'#8d9994',dark:'#27302f',glow:'#8fffe0',panel:'#244b67',
       gold:'#d2ac55',suit:'#f0f3f1',visor:'#d7ad4d',pack:'#b7c0bd',stripe:'#3ca876',flame:'#b8fff0'},

  audio:{wind:.62, birds:1},
  rocks:900,
  seed:7319
});
