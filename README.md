# Visor Datos SIG | Spatial GIS Data Migration & Visualization Platform

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![ASP.NET Core](https://img.shields.io/badge/ASP.NET_Core-8.0-512BD4?style=flat&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![SQL Server](https://img.shields.io/badge/SQL_Server-Spatial_Geometry-CC292B?style=flat&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![Leaflet](https://img.shields.io/badge/Leaflet-Interactive_Maps-199900?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)

Geographic Information System (GIS) designed to parse, migrate, and index Shapefile spatial datasets into Microsoft SQL Server geometry tables and query them via an interactive, responsive cartographic viewer.

---

## 🏛️ Architecture

- **`frontend/`**: Responsive map viewer built with React, Vite, Tailwind CSS, and Leaflet.
- **`backend/`**: High-performance spatial REST API built with ASP.NET Core 8.
- **`DatosSIG/`**: Sample shapefiles and geographic boundary data.
- **`ScriptDatabase/`**: Spatial SQL indexing scripts and geometry storage schemas.

---

## 🚀 Running with Docker Compose

```bash
docker compose up --build
```

---

## 👤 Author

Developed by **María Ilse Romero Saavedra** ([@miromero13](https://github.com/miromero13)).
