#!/bin/bash

#Redireccionar el port 80 al 3000
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 3000

#Iniciar la BD
mongod --dbpath=/home/amanita/git/nus/mongodb-data &

#Arrencar els servidor node.js
nodemon server.js 





