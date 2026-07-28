# MCABYZUM Launcher (Windows)

Instalador Fabric 1.20.1 (Horizons) con interfaz pywebview. Descarga Java, Minecraft, Fabric, mods del panel e IP del servidor mcabyzum.

## Reconstruir el .exe (solo Windows)

```powershell
cd mcabyzum-launcher
.\build.ps1
```

Copia `dist\MCABYZUM` a `backend/src/assets/launcher/MCABYZUM-win`.

## Panel Minipanelabyzum

1. Publicar despliegue de mods
2. Sincronizar launcher
3. Pestaña Landing → **Construir paquete launcher**

El ZIP incluye `MCABYZUM.exe`, `config.json` con la IP del servidor y carpeta `mods/` con los mods publicados.
