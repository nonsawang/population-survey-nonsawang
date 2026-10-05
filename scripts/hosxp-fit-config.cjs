const config=require('../config/hosxp-fit.json');
const m=config.mapping;
if(!config.mappingVersion||!m||!Number.isSafeInteger(m.lab)||m.lab<=0||['fee','department','specialty','doctor','diagnosis'].some(k=>typeof m[k]!=='string'||!m[k].trim()))throw Error('FIT_MAPPING_CONFIG_INVALID');
module.exports={mappingVersion:config.mappingVersion,mapping:Object.freeze({...m})};
