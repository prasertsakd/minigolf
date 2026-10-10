import { HOLES } from './physics.js';

const CANYON_HOLES = [
  { name:'Mesa Gate', par:4, tee:[-8,-41], pin:[7,39], bend:-5, sand:[[-18,14,5,5],[12,34,5,4]], water:[], terrain:{grade:-1.1,crossfall:.016,ridge:1.5,ridgeAt:.47,ridgeWidth:8,wave:.22,phase:.5} },
  { name:'Serpent Bend', par:4, tee:[10,-40], pin:[-9,39], bend:10, sand:[[17,20,6,5],[-15,35,5,4]], water:[[0,1,18,5]], terrain:{grade:.7,crossfall:-.018,ridge:-1.1,ridgeAt:.55,ridgeWidth:9,wave:.25,phase:1.5} },
  { name:'Redrock Short', par:3, tee:[-7,-25], pin:[8,24], bend:-3, sand:[[-2,18,5,4],[17,22,4,5]], water:[], terrain:{grade:.5,crossfall:.012,ridge:1,ridgeAt:.62,ridgeWidth:6,wave:.14,phase:2.5} },
  { name:'Twin Buttes', par:5, tee:[-14,-42], pin:[15,42], bend:-12, sand:[[14,10,6,5],[-12,34,5,5]], water:[[-1,1,7,19]], terrain:{grade:-.8,crossfall:.02,ridge:1.8,ridgeAt:.42,ridgeWidth:10,wave:.26,phase:3.5} },
  { name:'Oasis Drop', par:3, tee:[0,-30], pin:[0,30], bend:0, sand:[[-12,25,5,4],[12,25,5,4]], water:[[0,10,22,7]], terrain:{grade:1.2,crossfall:-.012,ridge:-1.2,ridgeAt:.54,ridgeWidth:7,wave:.2,phase:4.5} },
  { name:'Rim Runner', par:4, tee:[12,-41], pin:[-7,40], bend:8, sand:[[18,6,5,7],[-14,31,5,4]], water:[], terrain:{grade:-.6,crossfall:-.018,ridge:1.35,ridgeAt:.38,ridgeWidth:8,wave:.25,phase:5.5} },
  { name:'Dust Devil', par:5, tee:[-12,-42], pin:[11,42], bend:13, sand:[[-17,18,5,6],[13,37,5,4]], water:[[0,2,21,5]], terrain:{grade:.9,crossfall:.017,ridge:-1.2,ridgeAt:.5,ridgeWidth:10,wave:.28,phase:6.5} },
  { name:'Canyon Crossing', par:4, tee:[8,-39], pin:[-8,39], bend:-8, sand:[[17,27,5,5],[-15,14,5,5]], water:[[0,0,27,5]], terrain:{grade:-.4,crossfall:-.016,ridge:1.6,ridgeAt:.57,ridgeWidth:8,wave:.2,phase:7.5} },
  { name:'Last Light', par:4, tee:[-9,-40], pin:[10,40], bend:4, sand:[[-15,28,5,5],[15,15,5,4]], water:[], terrain:{grade:.6,crossfall:.014,ridge:1.2,ridgeAt:.45,ridgeWidth:8,wave:.18,phase:8.5} },
].map(hole=>({...hole,rockCount:21}));

export const COURSES = {
  lagoon: {
    id:'lagoon', name:'Geek Lagoon', theme:'lagoon', subtitle:'สนามเขตร้อน · 9 หลุม · Par 36',
    description:'แฟร์เวย์ริมทะเล ต้นปาล์ม และกรีนกลางน้ำ', holes:HOLES,
  },
  canyon: {
    id:'canyon', name:'Sunset Canyon', theme:'canyon', subtitle:'สนามแคนยอน · 9 หลุม · Par 36',
    description:'เนินหินสีอำพัน โอเอซิส และทางโค้งท้าลม', holes:CANYON_HOLES,
  },
};
