#!/bin/bash
# Ejecutar en el VPS (root) si los dominios Compose devuelven "404 page not found".
# Causas habituales: Traefik viejo + Docker 28+, o frontend fuera de dokploy-network.

set -euo pipefail

echo "== Traefik actual =="
docker ps -a --filter name=traefik --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

echo ""
echo "== Contenedores minipanelabyzum =="
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Networks}}' | grep -iE 'minipanel|mcabyzum|frontend|backend' || true

echo ""
echo "== Conectar frontend a dokploy-network (si falta) =="
FRONTEND="$(docker ps --format '{{.Names}}' | grep -iE 'frontend' | grep -iE 'minipanel|mcabyzum|hj12kk' | head -1 || true)"
if [ -n "${FRONTEND}" ]; then
  docker network connect dokploy-network "${FRONTEND}" 2>/dev/null && echo "Conectado: ${FRONTEND}" || echo "Ya en dokploy-network o red no existe: ${FRONTEND}"
else
  echo "No se encontró contenedor frontend. ¿Deploy completado?"
fi

echo ""
echo "== Reiniciar Traefik =="
if docker ps --format '{{.Names}}' | grep -qx 'dokploy-traefik'; then
  docker restart dokploy-traefik
  echo "dokploy-traefik reiniciado."
elif docker service ls 2>/dev/null | grep -q dokploy-traefik; then
  docker service update --force dokploy-traefik
  echo "servicio dokploy-traefik actualizado."
else
  echo "No se encontró dokploy-traefik."
fi

echo ""
echo "Si sigue 404, recrea Traefik con imagen traefik:v3.6.7 (Docker Engine 28+):"
echo "  https://docs.dokploy.com/docs/core/troubleshooting#recreate-traefik-service"
echo ""
echo "Prueba: curl -sI -H 'Host: mc.abyzum.com' http://127.0.0.1/"
