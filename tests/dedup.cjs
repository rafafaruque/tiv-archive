const assert = require('node:assert/strict')
const {sourceKey,indexSource,matchSource} = require('../src/lib/sourceIdentity')
const source = {om:'1',date:'2012-04-14',time:'12:00:00',st:'KS',slon:'-97',slat:'37',elon:'-96',elat:'38',len:'9.8',wid:'100',mag:'1',fat:'0',inj:'0'}
const row = {event_id:null,event_date:'2012-04-14',start_lon:-97,start_lat:37,end_lon:-96,end_lat:38,path_length_km:9.8,path_width_m:100,ef_rating:'1',fatalities:null,injuries:null}
assert.equal(sourceKey({...source}), sourceKey(source))
for (const changes of [{om:'2'},{date:'2012-04-15'},{time:'13:00:00'},{st:'OK'},{sg:'2'},{elon:'-95'}]) {
 assert.notEqual(sourceKey({...source,...changes}),sourceKey(source))
}
assert.equal(matchSource(row,indexSource([source])),source)
assert.equal(matchSource({...row,fatalities:0},indexSource([source])),source)
assert.equal(matchSource({...row,fatalities:1},indexSource([source])),null)
assert.equal(matchSource({...row,event_date:'1954-06-10'},indexSource([source])),null)
assert.equal(matchSource(row,indexSource([source,{...source,time:'13:00:00'}])),null)
assert.equal(matchSource({...row,event_id:'1'},indexSource([source,{...source,om:'2'}])),source)
assert.equal(matchSource({...row,end_lon:null},indexSource([source])),null)
assert.equal(sourceKey({...source,om:''}),null)
console.log('15 source identity assertions passed')
