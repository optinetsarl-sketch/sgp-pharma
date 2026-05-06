"""Liste des médicaments essentiels — adaptée au contexte togolais (CAMEG/LNME).
~150 produits couvrant: paludisme, antibiotiques, antalgiques, MNT, mère-enfant, VIH/TB, dermatologie.
Prix en FCFA (indicatifs marché togolais).
"""

# (code_barre, nom_commercial, dci, forme, categorie, seuil, prescription, prix_vente)
CAMEG_PRODUCTS = [
    # ---------------- Antalgiques / Antipyrétiques ----------------
    ("3401001000010", "Paracétamol 500mg", "Paracétamol", "Comprimé", "Antalgiques", 100, False, 500),
    ("3401001000027", "Paracétamol 1g", "Paracétamol", "Comprimé", "Antalgiques", 80, False, 800),
    ("3401001000034", "Paracétamol Sirop 120mg/5ml", "Paracétamol", "Sirop", "Pédiatrie", 30, False, 1500),
    ("3401001000041", "Paracétamol Suppositoire 150mg", "Paracétamol", "Suppositoire", "Pédiatrie", 25, False, 1200),
    ("3401001000058", "Ibuprofène 200mg", "Ibuprofène", "Comprimé", "Antalgiques", 60, False, 500),
    ("3401001000065", "Ibuprofène 400mg", "Ibuprofène", "Comprimé", "Antalgiques", 50, False, 800),
    ("3401001000072", "Ibuprofène Sirop 100mg/5ml", "Ibuprofène", "Sirop", "Pédiatrie", 20, False, 2000),
    ("3401001000089", "Aspirine 500mg", "Acide acétylsalicylique", "Comprimé", "Antalgiques", 50, False, 400),
    ("3401001000096", "Aspirine 100mg cardio", "Acide acétylsalicylique", "Comprimé", "Cardiologie", 60, False, 600),
    ("3401001000102", "Diclofénac 50mg", "Diclofénac", "Comprimé", "Anti-inflammatoires", 40, False, 800),
    ("3401001000119", "Diclofénac 75mg inj.", "Diclofénac", "Injectable", "Anti-inflammatoires", 20, True, 1500),
    ("3401001000126", "Diclofénac gel 1%", "Diclofénac", "Gel", "Anti-inflammatoires", 20, False, 2500),
    ("3401001000133", "Méloxicam 7.5mg", "Méloxicam", "Comprimé", "Anti-inflammatoires", 30, True, 1800),
    ("3401001000140", "Tramadol 50mg", "Tramadol", "Gélule", "Antalgiques", 25, True, 2200),
    ("3401001000157", "Tramadol 100mg inj.", "Tramadol", "Injectable", "Antalgiques", 15, True, 3500),
    ("3401001000164", "Codéine + Paracétamol", "Paracétamol+Codéine", "Comprimé", "Antalgiques", 25, True, 2500),
    ("3401001000171", "Indométacine 25mg", "Indométacine", "Gélule", "Anti-inflammatoires", 20, True, 1500),
    ("3401001000188", "Naproxène 500mg", "Naproxène", "Comprimé", "Anti-inflammatoires", 25, True, 1200),

    # ---------------- Antibiotiques ----------------
    ("3401002000017", "Amoxicilline 250mg", "Amoxicilline", "Gélule", "Antibiotiques", 40, True, 1500),
    ("3401002000024", "Amoxicilline 500mg", "Amoxicilline", "Gélule", "Antibiotiques", 40, True, 2500),
    ("3401002000031", "Amoxicilline Sirop 250mg/5ml", "Amoxicilline", "Sirop", "Antibiotiques", 25, True, 2200),
    ("3401002000048", "Augmentin 500mg/125mg", "Amoxicilline + Acide clavulanique", "Comprimé", "Antibiotiques", 30, True, 4000),
    ("3401002000055", "Augmentin 1g", "Amoxicilline + Acide clavulanique", "Comprimé", "Antibiotiques", 25, True, 4500),
    ("3401002000062", "Augmentin Sirop", "Amoxicilline + Acide clavulanique", "Sirop", "Antibiotiques", 20, True, 4500),
    ("3401002000079", "Doxycycline 100mg", "Doxycycline", "Gélule", "Antibiotiques", 30, True, 1500),
    ("3401002000086", "Tétracycline 250mg", "Tétracycline", "Gélule", "Antibiotiques", 30, True, 1200),
    ("3401002000093", "Ciprofloxacine 500mg", "Ciprofloxacine", "Comprimé", "Antibiotiques", 30, True, 2500),
    ("3401002000109", "Ciprofloxacine 200mg inj.", "Ciprofloxacine", "Injectable", "Antibiotiques", 15, True, 4500),
    ("3401002000116", "Norfloxacine 400mg", "Norfloxacine", "Comprimé", "Antibiotiques", 25, True, 1800),
    ("3401002000123", "Métronidazole 250mg", "Métronidazole", "Comprimé", "Antibiotiques", 40, True, 800),
    ("3401002000130", "Métronidazole 500mg", "Métronidazole", "Comprimé", "Antibiotiques", 35, True, 1200),
    ("3401002000147", "Métronidazole Sirop", "Métronidazole", "Sirop", "Antibiotiques", 20, True, 2000),
    ("3401002000154", "Métronidazole 500mg inj.", "Métronidazole", "Injectable", "Antibiotiques", 15, True, 1500),
    ("3401002000161", "Erythromycine 500mg", "Erythromycine", "Comprimé", "Antibiotiques", 25, True, 2200),
    ("3401002000178", "Cotrimoxazole 480mg", "Sulfaméthoxazole+Triméthoprime", "Comprimé", "Antibiotiques", 50, True, 800),
    ("3401002000185", "Cotrimoxazole Sirop", "Sulfaméthoxazole+Triméthoprime", "Sirop", "Antibiotiques", 20, True, 1500),
    ("3401002000192", "Céfixime 200mg", "Céfixime", "Comprimé", "Antibiotiques", 25, True, 4500),
    ("3401002000208", "Ceftriaxone 1g inj.", "Ceftriaxone", "Injectable", "Antibiotiques", 20, True, 3500),
    ("3401002000215", "Azithromycine 500mg", "Azithromycine", "Comprimé", "Antibiotiques", 30, True, 3500),
    ("3401002000222", "Azithromycine Sirop", "Azithromycine", "Sirop", "Antibiotiques", 20, True, 4000),
    ("3401002000239", "Gentamicine 80mg inj.", "Gentamicine", "Injectable", "Antibiotiques", 20, True, 1500),
    ("3401002000246", "Pénicilline V 1MUI", "Phénoxyméthylpénicilline", "Comprimé", "Antibiotiques", 30, True, 1200),
    ("3401002000253", "Spiramycine 3MUI", "Spiramycine", "Comprimé", "Antibiotiques", 25, True, 2800),
    ("3401002000260", "Clindamycine 300mg", "Clindamycine", "Gélule", "Antibiotiques", 20, True, 3500),
    ("3401002000277", "Cloxacilline 500mg", "Cloxacilline", "Gélule", "Antibiotiques", 25, True, 2200),
    ("3401002000284", "Chloramphénicol 250mg", "Chloramphénicol", "Gélule", "Antibiotiques", 20, True, 1500),

    # ---------------- Antipaludiques ----------------
    ("3401003000014", "Coartem 20/120mg", "Artéméther + Luméfantrine", "Comprimé", "Antipaludiques", 40, True, 3500),
    ("3401003000021", "Coartem Pédiatrique", "Artéméther + Luméfantrine", "Comprimé dispersible", "Antipaludiques", 30, True, 3000),
    ("3401003000038", "Artésunate-Amodiaquine", "Artésunate + Amodiaquine", "Comprimé", "Antipaludiques", 35, True, 3000),
    ("3401003000045", "Artésunate inj. 60mg", "Artésunate", "Injectable", "Antipaludiques", 25, True, 4500),
    ("3401003000052", "Quinine 500mg", "Quinine sulfate", "Comprimé", "Antipaludiques", 30, True, 1500),
    ("3401003000069", "Quinine 200mg inj.", "Quinine bichlorhydrate", "Injectable", "Antipaludiques", 25, True, 1800),
    ("3401003000076", "Sulfadoxine-Pyriméthamine", "SP", "Comprimé", "Antipaludiques", 40, True, 1200),
    ("3401003000083", "Méfloquine 250mg", "Méfloquine", "Comprimé", "Antipaludiques", 20, True, 4500),
    ("3401003000090", "Chloroquine 100mg", "Chloroquine phosphate", "Comprimé", "Antipaludiques", 30, False, 700),
    ("3401003000106", "Primaquine 15mg", "Primaquine", "Comprimé", "Antipaludiques", 20, True, 1800),
    ("3401003000113", "Doxycycline prophyl.", "Doxycycline", "Gélule", "Antipaludiques", 25, True, 1500),

    # ---------------- Antiparasitaires / Anthelminthiques ----------------
    ("3401004000018", "Mébendazole 100mg", "Mébendazole", "Comprimé", "Antiparasitaires", 40, False, 500),
    ("3401004000025", "Mébendazole Sirop", "Mébendazole", "Sirop", "Pédiatrie", 25, False, 1500),
    ("3401004000032", "Albendazole 400mg", "Albendazole", "Comprimé", "Antiparasitaires", 35, False, 800),
    ("3401004000049", "Praziquantel 600mg", "Praziquantel", "Comprimé", "Antiparasitaires", 25, True, 2500),
    ("3401004000056", "Ivermectine 3mg", "Ivermectine", "Comprimé", "Antiparasitaires", 30, True, 1800),
    ("3401004000063", "Niclosamide 500mg", "Niclosamide", "Comprimé", "Antiparasitaires", 20, True, 1500),
    ("3401004000070", "Métronidazole Antiparasitaire", "Métronidazole", "Comprimé", "Antiparasitaires", 30, True, 800),

    # ---------------- Antifongiques ----------------
    ("3401005000011", "Kétoconazole 200mg", "Kétoconazole", "Comprimé", "Dermatologie", 25, True, 2500),
    ("3401005000028", "Kétoconazole crème 2%", "Kétoconazole", "Crème", "Dermatologie", 20, False, 2200),
    ("3401005000035", "Fluconazole 150mg", "Fluconazole", "Gélule", "Dermatologie", 25, True, 2800),
    ("3401005000042", "Nystatine ovule", "Nystatine", "Ovule", "Gynécologie", 20, False, 1500),
    ("3401005000059", "Nystatine suspension", "Nystatine", "Suspension", "Pédiatrie", 20, False, 2000),
    ("3401005000066", "Clotrimazole crème", "Clotrimazole", "Crème", "Dermatologie", 25, False, 1500),
    ("3401005000073", "Miconazole gel buccal", "Miconazole", "Gel", "Dermatologie", 20, False, 2500),
    ("3401005000080", "Griseofulvine 500mg", "Griseofulvine", "Comprimé", "Dermatologie", 20, True, 2000),

    # ---------------- VIH / ARV ----------------
    ("3401006000010", "TDF/3TC/DTG", "Ténofovir+Lamivudine+Dolutégravir", "Comprimé", "VIH/TB", 30, True, 8500),
    ("3401006000027", "AZT/3TC", "Zidovudine+Lamivudine", "Comprimé", "VIH/TB", 25, True, 6500),
    ("3401006000034", "Efavirenz 600mg", "Efavirenz", "Comprimé", "VIH/TB", 25, True, 4500),
    ("3401006000041", "Névirapine 200mg", "Névirapine", "Comprimé", "VIH/TB", 25, True, 3500),
    ("3401006000058", "Lopinavir/Ritonavir", "LPV/r", "Comprimé", "VIH/TB", 20, True, 7500),

    # ---------------- Antituberculeux ----------------
    ("3401007000017", "RHZE (4FDC)", "Rifampicine+Isoniazide+Pyrazinamide+Ethambutol", "Comprimé", "VIH/TB", 25, True, 4500),
    ("3401007000024", "RH (2FDC)", "Rifampicine+Isoniazide", "Comprimé", "VIH/TB", 25, True, 2500),
    ("3401007000031", "Isoniazide 300mg", "Isoniazide", "Comprimé", "VIH/TB", 30, True, 1500),
    ("3401007000048", "Pyrazinamide 500mg", "Pyrazinamide", "Comprimé", "VIH/TB", 25, True, 1200),
    ("3401007000055", "Ethambutol 400mg", "Ethambutol", "Comprimé", "VIH/TB", 25, True, 1800),

    # ---------------- Cardiologie / HTA / MNT ----------------
    ("3401008000016", "Enalapril 10mg", "Enalapril", "Comprimé", "Cardiologie", 35, True, 1500),
    ("3401008000023", "Enalapril 20mg", "Enalapril", "Comprimé", "Cardiologie", 30, True, 2000),
    ("3401008000030", "Captopril 25mg", "Captopril", "Comprimé", "Cardiologie", 35, True, 1200),
    ("3401008000047", "Captopril 50mg", "Captopril", "Comprimé", "Cardiologie", 30, True, 1800),
    ("3401008000054", "Hydrochlorothiazide 25mg", "Hydrochlorothiazide", "Comprimé", "Cardiologie", 35, True, 800),
    ("3401008000061", "Furosémide 40mg", "Furosémide", "Comprimé", "Cardiologie", 30, True, 700),
    ("3401008000078", "Furosémide 20mg inj.", "Furosémide", "Injectable", "Cardiologie", 20, True, 1200),
    ("3401008000085", "Aténolol 50mg", "Aténolol", "Comprimé", "Cardiologie", 30, True, 1800),
    ("3401008000092", "Aténolol 100mg", "Aténolol", "Comprimé", "Cardiologie", 25, True, 2200),
    ("3401008000108", "Bisoprolol 5mg", "Bisoprolol", "Comprimé", "Cardiologie", 25, True, 2500),
    ("3401008000115", "Amlodipine 5mg", "Amlodipine", "Comprimé", "Cardiologie", 35, True, 1800),
    ("3401008000122", "Amlodipine 10mg", "Amlodipine", "Comprimé", "Cardiologie", 30, True, 2200),
    ("3401008000139", "Nifédipine LP 20mg", "Nifédipine", "Comprimé LP", "Cardiologie", 25, True, 1500),
    ("3401008000146", "Méthyldopa 250mg", "Méthyldopa", "Comprimé", "Cardiologie", 25, True, 1800),
    ("3401008000153", "Losartan 50mg", "Losartan", "Comprimé", "Cardiologie", 30, True, 2500),
    ("3401008000160", "Simvastatine 20mg", "Simvastatine", "Comprimé", "Cardiologie", 25, True, 2200),
    ("3401008000177", "Atorvastatine 20mg", "Atorvastatine", "Comprimé", "Cardiologie", 25, True, 2800),
    ("3401008000184", "Digoxine 0.25mg", "Digoxine", "Comprimé", "Cardiologie", 25, True, 1500),
    ("3401008000191", "Spironolactone 25mg", "Spironolactone", "Comprimé", "Cardiologie", 25, True, 1800),

    # ---------------- Diabète ----------------
    ("3401009000015", "Metformine 500mg", "Metformine", "Comprimé", "Diabète", 50, True, 1200),
    ("3401009000022", "Metformine 850mg", "Metformine", "Comprimé", "Diabète", 40, True, 1800),
    ("3401009000039", "Glibenclamide 5mg", "Glibenclamide", "Comprimé", "Diabète", 40, True, 1200),
    ("3401009000046", "Gliclazide 80mg", "Gliclazide", "Comprimé", "Diabète", 30, True, 2200),
    ("3401009000053", "Insuline NPH 100UI/ml", "Insuline humaine NPH", "Injectable", "Diabète", 15, True, 5500),
    ("3401009000060", "Insuline rapide 100UI/ml", "Insuline humaine rapide", "Injectable", "Diabète", 15, True, 5500),
    ("3401009000077", "Insuline mixte 70/30", "Insuline biphasique", "Injectable", "Diabète", 15, True, 6000),

    # ---------------- Gastro-entérologie ----------------
    ("3401010000013", "Oméprazole 20mg", "Oméprazole", "Gélule", "Gastro-entérologie", 50, False, 1500),
    ("3401010000020", "Oméprazole 40mg", "Oméprazole", "Gélule", "Gastro-entérologie", 30, False, 2200),
    ("3401010000037", "Ranitidine 150mg", "Ranitidine", "Comprimé", "Gastro-entérologie", 30, False, 800),
    ("3401010000044", "Cimétidine 200mg", "Cimétidine", "Comprimé", "Gastro-entérologie", 25, False, 700),
    ("3401010000051", "Smecta", "Diosmectite", "Sachet", "Gastro-entérologie", 50, False, 1200),
    ("3401010000068", "Lopéramide 2mg", "Lopéramide", "Gélule", "Gastro-entérologie", 30, False, 1500),
    ("3401010000075", "ORS Sachet OMS", "Sels de réhydratation", "Sachet", "Pédiatrie", 100, False, 300),
    ("3401010000082", "Dompéridone 10mg", "Dompéridone", "Comprimé", "Gastro-entérologie", 30, False, 1500),
    ("3401010000099", "Métoclopramide 10mg", "Métoclopramide", "Comprimé", "Gastro-entérologie", 25, True, 1200),
    ("3401010000105", "Métoclopramide 10mg inj.", "Métoclopramide", "Injectable", "Gastro-entérologie", 20, True, 1500),
    ("3401010000112", "Bisacodyl 5mg", "Bisacodyl", "Comprimé", "Gastro-entérologie", 25, False, 800),
    ("3401010000129", "Charbon végétal", "Charbon activé", "Gélule", "Gastro-entérologie", 25, False, 1200),
    ("3401010000136", "Pansement gastrique", "Hydroxyde Al/Mg", "Suspension", "Gastro-entérologie", 25, False, 2000),

    # ---------------- Respiratoire / Allergies ----------------
    ("3401011000012", "Salbutamol aérosol", "Salbutamol", "Aérosol", "Respiratoire", 25, True, 3500),
    ("3401011000029", "Salbutamol sirop", "Salbutamol", "Sirop", "Pédiatrie", 20, True, 2200),
    ("3401011000036", "Béclométasone aérosol", "Béclométasone", "Aérosol", "Respiratoire", 20, True, 4500),
    ("3401011000043", "Théophylline 100mg", "Théophylline", "Comprimé", "Respiratoire", 25, True, 1500),
    ("3401011000050", "Cétirizine 10mg", "Cétirizine", "Comprimé", "Respiratoire", 40, False, 1200),
    ("3401011000067", "Loratadine 10mg", "Loratadine", "Comprimé", "Respiratoire", 35, False, 1500),
    ("3401011000074", "Prométhazine 25mg", "Prométhazine", "Comprimé", "Respiratoire", 25, False, 1200),
    ("3401011000081", "Dexchlorpheniramine 2mg", "Dexchlorpheniramine", "Comprimé", "Respiratoire", 25, False, 800),
    ("3401011000098", "Sirop antitussif", "Dextrométhorphane", "Sirop", "Respiratoire", 25, False, 1800),

    # ---------------- Dermatologie / Antiseptiques ----------------
    ("3401012000019", "Bétadine dermique 10%", "Povidone iodée", "Solution", "Dermatologie", 30, False, 3000),
    ("3401012000026", "Bétadine gynéco", "Povidone iodée", "Solution", "Gynécologie", 20, False, 3500),
    ("3401012000033", "Chlorhexidine 0.05%", "Chlorhexidine", "Solution", "Dermatologie", 25, False, 2500),
    ("3401012000040", "Dakin Cooper", "Hypochlorite Na", "Solution", "Dermatologie", 25, False, 1500),
    ("3401012000057", "Hydrocortisone crème 1%", "Hydrocortisone", "Crème", "Dermatologie", 25, False, 1500),
    ("3401012000064", "Bétaméthasone crème", "Bétaméthasone", "Crème", "Dermatologie", 20, True, 2500),
    ("3401012000071", "Permethrin 5% crème", "Permethrin", "Crème", "Dermatologie", 20, True, 3500),
    ("3401012000088", "Soufre pommade 10%", "Soufre", "Pommade", "Dermatologie", 25, False, 1200),
    ("3401012000095", "Acide fusidique crème", "Acide fusidique", "Crème", "Dermatologie", 20, True, 2800),
    ("3401012000101", "Calamine lotion", "Calamine", "Lotion", "Dermatologie", 25, False, 2000),

    # ---------------- Gynécologie / Mère-Enfant ----------------
    ("3401013000018", "Acide folique 5mg", "Acide folique", "Comprimé", "Gynécologie", 50, False, 500),
    ("3401013000025", "Fer + Acide folique", "Sulfate ferreux + Folate", "Comprimé", "Gynécologie", 60, False, 800),
    ("3401013000032", "Misoprostol 200µg", "Misoprostol", "Comprimé", "Gynécologie", 20, True, 4500),
    ("3401013000049", "Méthylergométrine 0.2mg", "Méthylergométrine", "Injectable", "Gynécologie", 15, True, 2500),
    ("3401013000056", "Ocytocine 5UI", "Ocytocine", "Injectable", "Gynécologie", 20, True, 1500),
    ("3401013000063", "Pilule combinée OP", "Lévonorgestrel+Ethinylestradiol", "Comprimé", "Gynécologie", 30, True, 2500),
    ("3401013000070", "Microlut", "Lévonorgestrel", "Comprimé", "Gynécologie", 25, True, 2200),
    ("3401013000087", "Norlevo (urgence)", "Lévonorgestrel 1.5mg", "Comprimé", "Gynécologie", 25, False, 3000),
    ("3401013000094", "DIU TCu380A", "Cuivre", "DIU", "Gynécologie", 10, True, 8500),
    ("3401013000100", "Préservatif masculin", "Latex", "Préservatif", "Gynécologie", 100, False, 200),

    # ---------------- Pédiatrie ----------------
    ("3401014000017", "Doliprane Sirop enfant", "Paracétamol", "Sirop", "Pédiatrie", 30, False, 2200),
    ("3401014000024", "Vitamine C sirop", "Acide ascorbique", "Sirop", "Pédiatrie", 25, False, 1800),
    ("3401014000031", "Vitamine A 200000UI", "Rétinol", "Capsule", "Pédiatrie", 30, False, 800),

    # ---------------- Vitamines / Minéraux ----------------
    ("3401015000016", "Vitamine C 1000mg eff.", "Acide ascorbique", "Comprimé effervescent", "Vitamines", 50, False, 1500),
    ("3401015000023", "Multivitamines", "Multivitamines", "Comprimé", "Vitamines", 40, False, 2000),
    ("3401015000030", "Vitamine B12 1000µg", "Cyanocobalamine", "Injectable", "Vitamines", 25, False, 1500),
    ("3401015000047", "Vitamine D3 1000UI", "Cholécalciférol", "Comprimé", "Vitamines", 30, False, 1800),
    ("3401015000054", "Calcium 500mg + D3", "Carbonate Ca + D3", "Comprimé", "Vitamines", 30, False, 2200),
    ("3401015000061", "Zinc 20mg", "Sulfate de zinc", "Comprimé", "Vitamines", 30, False, 1200),
    ("3401015000078", "Magnésium B6", "Magnésium + B6", "Comprimé", "Vitamines", 30, False, 1800),
    ("3401015000085", "Complexe B", "Vitamines B1-B6-B12", "Comprimé", "Vitamines", 30, False, 1500),

    # ---------------- Anesthésiques / Solutions ----------------
    ("3401016000015", "Lidocaïne 2% inj.", "Lidocaïne", "Injectable", "Anesthésiques", 25, True, 1500),
    ("3401016000022", "Lidocaïne gel 2%", "Lidocaïne", "Gel", "Anesthésiques", 20, True, 2200),
    ("3401016000039", "Sérum salé 0.9% 500ml", "NaCl 0.9%", "Perfusion", "Solutions", 30, False, 1500),
    ("3401016000046", "Glucose 5% 500ml", "Glucose", "Perfusion", "Solutions", 30, False, 1500),
    ("3401016000053", "Ringer Lactate 500ml", "Ringer Lactate", "Perfusion", "Solutions", 25, False, 2000),
    ("3401016000060", "Eau PPI 10ml", "Eau pour préparation injectable", "Injectable", "Solutions", 50, False, 200),

    # ---------------- Ophtalmologie / ORL ----------------
    ("3401017000014", "Collyre Tobramycine", "Tobramycine", "Collyre", "Ophtalmologie", 20, True, 2500),
    ("3401017000021", "Collyre Chloramphénicol", "Chloramphénicol", "Collyre", "Ophtalmologie", 20, True, 1500),
    ("3401017000038", "Collyre Larmes artificielles", "Hypromellose", "Collyre", "Ophtalmologie", 25, False, 2200),
    ("3401017000045", "Gouttes auriculaires", "Néomycine + Polymyxine", "Solution auriculaire", "ORL", 20, True, 2500),

    # ---------------- Antiseptiques / Pansement ----------------
    ("3401018000013", "Compresses stériles 7.5x7.5", "Coton", "Pansement", "Matériel", 50, False, 200),
    ("3401018000020", "Bande de gaze 5m", "Coton", "Pansement", "Matériel", 40, False, 500),
    ("3401018000037", "Sparadrap 5cm", "Adhésif", "Pansement", "Matériel", 40, False, 1000),
    ("3401018000044", "Seringue 5ml", "Plastique", "Matériel", "Matériel", 100, False, 100),
    ("3401018000051", "Aiguille 21G", "Acier", "Matériel", "Matériel", 100, False, 50),
    ("3401018000068", "Gants latex (paire)", "Latex", "Matériel", "Matériel", 100, False, 200),
    ("3401018000075", "Thermomètre digital", "Plastique", "Matériel", "Matériel", 15, False, 5000),
    ("3401018000082", "Tensiomètre manuel", "Métal", "Matériel", "Matériel", 5, False, 25000),
]

CAMEG_CATEGORIES = [
    "Antalgiques", "Anti-inflammatoires", "Antibiotiques", "Antipaludiques",
    "Antiparasitaires", "VIH/TB", "Cardiologie", "Diabète",
    "Gastro-entérologie", "Respiratoire", "Dermatologie", "Pédiatrie",
    "Gynécologie", "Vitamines", "Anesthésiques", "Solutions",
    "Ophtalmologie", "ORL", "Matériel",
]
