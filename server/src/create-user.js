import {db} from './db.js';
import bcrypt from 'bcryptjs';
const {ADMIN_NAME:name,ADMIN_EMAIL:email,ADMIN_PASSWORD:password}=process.env;
try {if(!name||!email||!password||password.length<12) throw new Error('Define ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres) mediante variables de entorno.');
await db.execute('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)',[name,email.toLowerCase(),await bcrypt.hash(password,12)]);console.log('Usuario creado.');} finally {await db.end();}
