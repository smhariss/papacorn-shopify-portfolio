export function sceneProgress(y,start,travel){return travel>0?Math.min(1,Math.max(0,(y-start)/travel)):0;}
export function wrapFlavor(index,count){return ((index%count)+count)%count;}
