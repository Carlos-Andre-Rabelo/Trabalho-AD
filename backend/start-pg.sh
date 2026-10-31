#!/bin/sh
set -e
mkdir -p /mnt/pgdata
mountpoint -q /mnt/pgdata || mount -o loop "/mnt/host/c/Users/Carlos Rabelo/Documents/Trabalho-AD/pgdata.img" /mnt/pgdata

mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql

su - postgres -c "pg_ctl -D /mnt/pgdata/data -l /mnt/pgdata/data/logfile start"
sleep 2
su - postgres -c "psql -U postgres -c 'CREATE DATABASE ru_metrics;'" || true
su - postgres -c "psql -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" || true
echo "PostgreSQL rodando com sucesso na porta 5432!"
