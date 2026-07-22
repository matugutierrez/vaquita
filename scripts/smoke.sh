#!/bin/bash
set -e
cd /data/vaquita
rm -f vaquita.db vaquita.db-*
kill $(cat /tmp/vaquita.pid 2>/dev/null) 2>/dev/null || true
nohup node server.js > /tmp/vaquita.log 2>&1 &
echo $! > /tmp/vaquita.pid
sleep 1.5
cat /tmp/vaquita.log

jget() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(eval('JSON.parse(d).'+process.argv[1]))}catch(e){console.log('ERR:'+d)}})" "$1"; }

echo '--- health:'
curl -s localhost:3000/api/health
echo

R1=$(curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{"nombre":"Matu","email":"matu@test.ar","password":"clave-segura-123"}')
T1=$(echo "$R1" | jget token)
U1=$(echo "$R1" | jget user.id)
R2=$(curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{"nombre":"Fer","email":"fer@test.ar","password":"otra-clave-456"}')
T2=$(echo "$R2" | jget token)
U2=$(echo "$R2" | jget user.id)
echo "user1=$U1 user2=$U2"

echo '--- password debil (debe fallar):'
curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{"nombre":"X","email":"x@test.ar","password":"corta"}'
echo

echo '--- login mal 5 veces -> bloqueo (aun con clave correcta):'
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"fer@test.ar","password":"malaclave123"}'; done
curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"fer@test.ar","password":"otra-clave-456"}' | head -c 120
echo

G=$(curl -s -X POST localhost:3000/api/grupos -H "Authorization: Bearer $T1" -H 'Content-Type: application/json' -d '{"nombre":"Asado test","color":"verde"}')
GID=$(echo "$G" | jget id)
COD=$(echo "$G" | jget codigo)
echo "grupo=$GID codigo=$COD"

echo '--- unirse:'
curl -s -X POST localhost:3000/api/grupos/unirse -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d "{\"codigo\":\"$COD\"}" | head -c 100
echo

echo '--- gasto 5000 dividido 50/50:'
curl -s -X POST localhost:3000/api/grupos/$GID/gastos -H "Authorization: Bearer $T1" -H 'Content-Type: application/json' -d "{\"titulo\":\"Carne\",\"monto\":500000,\"categoria\":\"comida\",\"partes\":[{\"user_id\":\"$U1\",\"monto\":250000},{\"user_id\":\"$U2\",\"monto\":250000}]}" | head -c 130
echo

echo '--- partes que no suman (debe fallar):'
curl -s -X POST localhost:3000/api/grupos/$GID/gastos -H "Authorization: Bearer $T1" -H 'Content-Type: application/json' -d "{\"titulo\":\"Mal\",\"monto\":500000,\"partes\":[{\"user_id\":\"$U1\",\"monto\":100}]}"
echo

echo '--- saldos:'
curl -s localhost:3000/api/grupos/$GID/saldos -H "Authorization: Bearer $T2"
echo

echo '--- acceso de no-miembro (debe fallar):'
R3=$(curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{"nombre":"Intruso","email":"intruso@test.ar","password":"clave-intrusa-99"}')
T3=$(echo "$R3" | jget token)
curl -s localhost:3000/api/grupos/$GID -H "Authorization: Bearer $T3"
echo

echo '--- 2FA setup + confirm con codigo TOTP real:'
S=$(curl -s -X POST localhost:3000/api/auth/2fa/setup -H "Authorization: Bearer $T1" | jget secret)
CODE=$(node -e '
const crypto = require("node:crypto");
const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function dec(s){let bits=0,v=0,out=[];for(const ch of s){v=(v<<5)|B32.indexOf(ch);bits+=5;if(bits>=8){out.push((v>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
const c=Math.floor(Date.now()/1000/30);const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(c));
const h=crypto.createHmac("sha1",dec(process.argv[1])).update(buf).digest();
const o=h[h.length-1]&0xf;const code=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];
console.log(String(code%1e6).padStart(6,"0"));' "$S")
curl -s -X POST localhost:3000/api/auth/2fa/confirm -H "Authorization: Bearer $T1" -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}"
echo
echo '--- login ahora pide 2FA:'
curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"matu@test.ar","password":"clave-segura-123"}' | head -c 60
echo
echo '--- logout-all invalida el token:'
curl -s -X POST localhost:3000/api/auth/logout-all -H "Authorization: Bearer $T2" > /dev/null
curl -s localhost:3000/api/grupos -H "Authorization: Bearer $T2"
echo
echo 'SMOKE OK'
