import {generateDaily} from './generator.mjs';
self.onmessage=({data})=>{try{const {solution,...puzzle}=generateDaily(data.mode,data.day);self.postMessage({id:data.id,puzzle});}catch(error){self.postMessage({id:data.id,error:error.message});}};
