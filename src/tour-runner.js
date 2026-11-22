import {findNext} from './navigation.js';
import {getTourStop} from './tours.js';

// Tour mode intentionally stays close to a landmark; a 20,000 km radius makes
// sense for free wandering, not for a "Pyramids of Giza" sightseeing tour.
export async function findTourCandidate({
  tour,startIndex=0,visited=new Set(),visitedPoints=[],searchAtRadius,
  signal,onStop=()=>{},onSkip=()=>{},random=Math.random
}) {
  if(!tour?.stops || !Number.isInteger(startIndex) || startIndex<0)
    throw new TypeError('Tour and valid index required');
  let skipped=0;
  for(let index=startIndex;index<tour.stops.length;index++){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    const stop=getTourStop(tour,index);
    if(!stop){skipped++;onSkip({index,stop:null,reason:'invalid-location'});continue}
    onStop({index,stop,total:tour.stops.length});
    try{
      const candidate=await findNext({
        origin:{lat:stop.lat,lng:stop.lng},baseRadiusKm:2,maxRadiusKm:4,
        visited,visitedPoints,minSeparationKm:0.02,
        searchAtRadius:opts=>searchAtRadius({...opts,probeCount:2}),signal,random
      });
      return {candidate,stop,index,skipped};
    }catch(error){
      if(error.name==='AbortError')throw error;
      if(error.name!=='NoLocationsError')throw error;
      skipped++;
      onSkip({index,stop,reason:'unavailable-in-sampled-provider-data'});
    }
  }
  return {candidate:null,stop:null,index:tour.stops.length,skipped};
}
