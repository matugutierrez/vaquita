#!/bin/bash
set -e
cd /data/vaquita
kill $(cat /tmp/vaquita.pid 2>/dev/null) 2>/dev/null || true
sleep 0.3
nohup node server.js > /tmp/vaquita.log 2>&1 &
echo $! > /tmp/vaquita.pid
sleep 1.5

jget() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(eval('JSON.parse(d).'+process.argv[1]))}catch(e){console.log('ERR:'+d)}})" "$1"; }

# OJO: al reiniciar sin SECRET los tokens viejos no valen; registro un usuario nuevo.
R1=$(curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{"nombre":"Caro","email":"caro@test.ar","password":"clave-carola-777"}')
T1=$(echo "$R1" | jget token)

echo '--- 2FA setup + confirm con codigo TOTP real:'
S=$(curl -s -X POST localhost:3000/api/auth/2fa/setup -H "Authorization: Bearer $T1" | jget secret)
echo "secret=$S"
totp() { node -e '
const crypto = require("node:crypto");
const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function dec(s){let bits=0,v=0,out=[];for(const ch of s){v=(v<<5)|B32.indexOf(ch);bits+=5;if(bits>=8){out.push((v>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
const c=Math.floor(Date.now()/1000/30);const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(c));
const h=crypto.createHmac("sha1",dec(process.argv[1])).update(buf).digest();
const o=h[h.length-1]&0xf;const code=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];
console.log(String(code%1e6).padStart(6,"0"));' "$1"; }
CODE=$(totp "$S")
curl -s -X POST localhost:3000/api/auth/2fa/confirm -H "Authorization: Bearer $T1" -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}"
echo

echo '--- login ahora devuelve requiere2fa + tempToken:'
L=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"caro@test.ar","password":"clave-carola-777"}')
echo "$L" | head -c 80
echo
TMP=$(echo "$L" | jget tempToken)

echo '--- completar 2FA con codigo:'
CODE2=$(totp "$S")
curl -s -X POST localhost:3000/api/auth/2fa -H 'Content-Type: application/json' -d "{\"tempToken\":\"$TMP\",\"code\":\"$CODE2\"}" | head -c 60
echo

echo '--- codigo incorrecto (debe fallar):'
curl -s -X POST localhost:3000/api/auth/2fa -H 'Content-Type: application/json' -d "{\"tempToken\":\"$TMP\",\"code\":\"000000\"}"
echo

echo '--- tempToken NO sirve como token de sesion (debe fallar):'
curl -s localhost:3000/api/grupos -H "Authorization: Bearer $TMP"
echo

echo '--- logout-all invalida el token de sesion:'
curl -s -X POST localhost:3000/api/auth/logout-all -H "Authorization: Bearer $T1" > /dev/null
curl -s localhost:3000/api/grupos -H "Authorization: Bearer $T1"
echo
echo 'SMOKE2 OK'
