/// <reference lib="webworker" />
import {simulateMonteCarlo,type MonteCarloInput} from '../lib/monteCarlo'
type Request={id:number;input:MonteCarloInput;seed:number}
self.onmessage=(event:MessageEvent<Request>)=>{const{id,input,seed}=event.data;try{const result=simulateMonteCarlo(input,seed,progress=>self.postMessage({id,type:'progress',progress}));self.postMessage({id,type:'result',result})}catch(error){self.postMessage({id,type:'error',error:error instanceof Error?error.message:'No se pudo ejecutar la simulación.'})}}
