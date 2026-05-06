"""Coordonnées officielles OPTINET SARLU — utilisées dans tous les documents générés."""

OPTINET = {
    "name": "OPTINET SARLU",
    "tagline": "Solutions Réseaux & Télécommunications",
    "address_line1": "Quartier Agoè Cacavéli",
    "address_line2": "Derrière la CEET",
    "city": "Lomé — Togo",
    "phone_1": "+228 90 74 84 65",
    "phone_2": "+228 99 05 84 71",
    "email": "optinetsarl@gmail.com",
    "website": "www.optinet.tg",
    "rccm": "TG-LFW-01-2026-B13-00831",
    "nif": "1002114979",
    "director_name": "NABINE Tassounti",
    "director_title": "Directeur Général / Ingénieur Réseaux & Télécommunications",
}


def address_block_lines() -> list[str]:
    return [
        OPTINET["address_line1"],
        OPTINET["address_line2"],
        OPTINET["city"],
    ]


def contact_block_lines() -> list[str]:
    return [
        f"Tél : {OPTINET['phone_1']}  ·  {OPTINET['phone_2']}",
        f"Email : {OPTINET['email']}",
        f"Web : {OPTINET['website']}",
    ]


def legal_line() -> str:
    return f"RCCM : {OPTINET['rccm']}  ·  NIF : {OPTINET['nif']}"
