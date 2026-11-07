import {expect, test} from 'bun:test';
import {assertBackupEncoderShape, assertBackupTarget, runBoundImport} from '../src/utils/backup-target';
import {consoleDeviceKey, autoFollowConsoleDevice} from '../src/utils/console-device';
const air={vendorId:65534,productId:108,productName:'RIE68',vendorProductId:4294836332,requiredDefinitionVersion:'v3' as const,modelDefinitionId:'morgrie-air68'};
const dos={...air,productName:'DOS 68',modelDefinitionId:'morgrie-dos68'};
test('model backups reject shared-ID ambiguity and cross-model imports',()=>{
 expect(()=>assertBackupTarget({vendorProductId:air.vendorProductId},air)).toThrow('model');
 expect(()=>assertBackupTarget({vendorProductId:air.vendorProductId,modelDefinitionId:'morgrie-air68'},dos)).toThrow();
 expect(()=>assertBackupTarget({vendorProductId:dos.vendorProductId,modelDefinitionId:'morgrie-dos68'},dos)).not.toThrow();
});
test('legacy backups retain compatibility for unambiguous USB IDs',()=>{
 const st={...air,productId:177,productName:'RKB65',vendorProductId:4294836401,modelDefinitionId:undefined};
 expect(()=>assertBackupTarget({vendorProductId:st.vendorProductId},st)).not.toThrow();
});
test('file read followed by target change cannot reach first write',async()=>{
 let current=true;const calls:string[]=[];
 await expect(runBoundImport({assertCurrent:()=>{if(!current)throw Error('changed');}},async()=>{current=false;return {};},()=>{},[async()=>{calls.push('write');}])).rejects.toThrow();
 expect(calls).toEqual([]);
});
test('batch target change prevents subsequent writes',async()=>{
 let current=true;const calls:string[]=[];
 await expect(runBoundImport({assertCurrent:()=>{if(!current)throw Error('changed');}},async()=>({}),()=>{},[async()=>{calls.push('macro');current=false;},async()=>{calls.push('keymap');}])).rejects.toThrow();
 expect(calls).toEqual(['macro']);
});
test('Console shared ID never auto-follows; identical objects alone retain same key',()=>{
 const a={vendorId:65534,productId:108,productName:'DOS 68'} as HIDDevice;
 const b={...a} as HIDDevice;
 expect(consoleDeviceKey(a)).toBe(consoleDeviceKey(a));
 expect(consoleDeviceKey(a)).not.toBe(consoleDeviceKey(b));
 expect(autoFollowConsoleDevice([a,b],dos)).toBeUndefined();
 expect(autoFollowConsoleDevice([a],dos)).toBeUndefined();
});


test.each([
  ['no encoder on target', {keys:[],optionKeys:{}}, [[['KC_A','KC_B']]]],
  ['extra encoder', {keys:[{ei:0}],optionKeys:{}}, [[['KC_A','KC_B']],[['KC_A','KC_B']]]],
  ['extra layer', {keys:[{ei:0}],optionKeys:{}}, [[['KC_A','KC_B'],['KC_A','KC_B']]]],
  ['missing layer', {keys:[{ei:0}],optionKeys:{}}, [[]]],
])('%s fails before any import write', async (_name, layouts, encoders)=>{
 const writes:string[]=[];
 await expect(runBoundImport({assertCurrent:()=>{}},async()=>({encoders}),
   data=>assertBackupEncoderShape(data.encoders,{layouts} as any,1),
   [async()=>{writes.push('macros');},async()=>{writes.push('keymap');}])).rejects.toThrow();
 expect(writes).toEqual([]);
});
