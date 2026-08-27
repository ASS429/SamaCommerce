# Micro-service IA (Modules A & B) — FastAPI + modèles scikit-learn.
#
# Image Docker plutôt que le runtime Python natif de Render : les versions sont
# ÉPINGLÉES (requirements.txt, choix S12) et le .joblib a été sérialisé avec
# scikit-learn 1.9.0 exactement. Un environnement qui résoudrait une autre
# version chargerait mal les modèles — ou pire, les chargerait de travers.
FROM python:3.14-slim

# Empêche Python d'écrire des .pyc et force la sortie non tamponnée : sans ça,
# les logs Render arrivent par paquets et le diagnostic devient pénible.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

# Les dépendances d'abord : cette couche est réutilisée tant que
# requirements.txt ne bouge pas, ce qui raccourcit beaucoup les redéploiements.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Le code et les MODÈLES ENTRAÎNÉS (versionnés dans le dépôt : sans eux, le
# service retomberait silencieusement sur ses heuristiques).
COPY app ./app
COPY models ./models

# Render fournit le port dans $PORT ; 8001 sert au lancement local.
ENV PORT=8001
EXPOSE 8001

# `sh -c` est nécessaire pour que $PORT soit développé.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
