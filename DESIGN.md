# DESIGN.md — Content Agent Design System

Référence unique pour toute l'interface. Toujours respecter ce document avant d'écrire du CSS ou des classes Tailwind.

---

## 1. IDENTITÉ VISUELLE

### Palette de couleurs (CSS variables)

```css
--bg-base:        #0F0F10;  /* Background principal — noir chaud, pas pur */
--bg-card:        #1A1A1F;  /* Background cards */
--bg-hover:       #222228;  /* Background hover */
--bg-sidebar:     #0A0A0F;  /* Background sidebar */

--border:         #2A2A32;  /* Bordures standard */
--border-subtle:  #1E1E26;  /* Bordures très subtiles */

--text-primary:   #F0F0F5;  /* Texte principal */
--text-secondary: #8B8B9E;  /* Texte secondaire */
--text-tertiary:  #55555F;  /* Texte tertiaire */

--accent:         #10B981;  /* Vert émeraude — seule couleur signature */
--accent-hover:   #34D399;  /* Vert hover */
--accent-subtle:  #064E3B;  /* Background accent léger */
--accent-bg:      #0D2B22;  /* Background vert très sombre (coach cards, active nav) */

--success:        #10B981;
--warning:        #F59E0B;
--danger:         #EF4444;
--info:           #60A5FA;
```

### Tailwind mapping (brand = vert émeraude)

| Token Tailwind   | Couleur hex |
|-----------------|-------------|
| `brand-500`     | `#10B981`   |
| `brand-400`     | `#34D399`   |
| `brand-900`     | `#064E3B`   |

### Typographie

- **Font principale** : `Geist` via `next/font/google`
- **Font monospace** : `Geist Mono` pour chiffres/scores importants
- **Titres de page** : `24px`, weight `600`, tracking `-0.02em`
- **Labels de section** : `11px`, weight `500`, `uppercase`, tracking `0.08em`, couleur tertiaire (`#55555F`)
- **Corps** : `14px`, weight `400`, line-height `1.6`
- **Labels** : `12px`, weight `500`

---

## 2. COMPOSANTS DE BASE

### Cards

```
border-radius: 10px
border: 1px solid #2A2A32
background: #1A1A1F
padding: 20px
hover: border-color #3A3A45 + box-shadow subtil 0 4px 12px rgba(0,0,0,0.3)
transition: all 0.15s ease
```

Classe utilitaire `.card` dans globals.css.

### Boutons

**Primary**
```
bg: #10B981  |  hover: #34D399
color: #0F0F10 (texte sombre sur vert)
border-radius: 8px  |  padding: 8px 16px
font-size: 13px  |  weight: 600
transition: 0.15s ease
active: scale(0.98)
```

**Secondary**
```
bg: transparent  |  border: 1px solid #2A2A32
color: #F0F0F5  |  hover bg: #1A1A1F
mêmes dimensions que Primary
```

**Ghost**
```
bg: transparent  |  no border
color: #8B8B9E  |  hover color: #F0F0F5  |  hover bg: #1A1A1F
pour les actions secondaires discrètes
```

### Badges

```
border-radius: 6px  |  padding: 2px 8px
font-size: 11px  |  weight: 500

default:  bg #1A1A1F,  color #8B8B9E
success:  bg #064E3B,  color #10B981
warning:  bg #451A03,  color #F59E0B
danger:   bg #450A0A,  color #EF4444
info:     bg #0F2744,  color #60A5FA
```

### Inputs

```
bg: #111115  |  border: 1px solid #2A2A32
border-radius: 8px  |  padding: 8px 12px
font-size: 14px  |  color: #F0F0F5
focus: border-color #10B981, outline: none
placeholder: #55555F
```

---

## 3. LAYOUT & SPACING

### Sidebar

```
width: 220px
bg: #0A0A0F
border-right: 1px solid #1E1E26
```

**Logo**
```
16px, weight 700, color white
Point vert #10B981 animé (pulse lent 2s) à côté du nom
```

**Nav items**
```
padding: 6px 12px  |  border-radius: 6px
font-size: 13px  |  weight: 450
couleur inactive: #8B8B9E
hover: bg #1A1A1F, color #F0F0F5
active: bg #0D2B22, color #10B981, border-left: 2px solid #10B981
```

**Groupes nav** (séparés par labels)
```
Groupe 1 — "CONTENU" : Inspirations, Créer, Calendrier
Groupe 2 — "MOI"     : Mon compte, Mon profil, Coûts

Labels: 11px uppercase tracking-wide #55555F
margin-top: 24px  |  padding: 0 12px 6px
```

### Contenu principal

```
padding: 32px 40px
max-width: 1200px
```

### Grilles de cards

```
gap: 16px
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))
```

---

## 4. MICRO-ANIMATIONS

- **Hover cards** : `translateY(-1px)` + shadow subtile
- **Boutons au clic** : `scale(0.98)`
- **Apparition éléments** : `fadeIn + translateY(8px)`, durée `0.2s`, easing `ease-out`
- **Loading states** : pulse animation subtile en vert `#10B981`
- **Transitions globales** : `0.15s ease` — jamais plus long
- **Logo point vert** : pulse lent `2s` infini

---

## 5. PATTERNS SPÉCIFIQUES À L'APP

### KPI Cards (Mon compte)

```
Chiffre en grand : 28px, weight 700, Geist Mono
Label : 11px uppercase #55555F
Tendance : badge coloré discret
Pas d'icône colorée envahissante
```

### CreatorCards (Inspirations)

```
Avatar circulaire 36px
Initiales sur bg #1A1A1F en fallback
Nom 14px weight 600  |  URL 12px #8B8B9E
Badge catégorie : style badge sobre dark
Hover : border-color #10B981 subtil
```

### Coach IA cards

```
border-left: 3px solid #10B981
background: #0D1F19 (vert très sombre)
Titre : 11px uppercase #10B981
Contenu : 14px #F0F0F5
```

### Graphiques (recharts)

```
background: transparent
grid lines: #1E1E26
axes: #55555F, 11px
couleur principale: #10B981
couleur secondaire: #34D399
Tooltip: bg #1A1A1F, border #2A2A32, border-radius 8px
```

### Heatmap GitHub style

```
Empty:  #1A1A1F
Low:    #064E3B
Medium: #059669
High:   #10B981
Viral:  #34D399
```

### Tabs (Inspirations)

```
Style underline comme Linear
Active : color #F0F0F5, border-bottom 2px solid #10B981
Inactive : color #55555F, hover color #8B8B9E
Pas de background coloré sur les tabs
```

### Chat (Create)

```
Messages utilisateur : bg #1A1A1F, rounded
Messages agent : bg #0D2B22 avec border-left 2px solid #10B981
Posts générés : cards dark avec hover border vert
```

### Calendar

```
Colonnes jours : bg #1A1A1F, border #2A2A32
Posts cards : compact, badge format coloré
Jour actuel : border-top 2px solid #10B981
```

---

## 6. RÈGLES À NE JAMAIS ENFREINDRE

```
❌ Pas de fond blanc ou gris clair nulle part
❌ Pas de gradients violets/roses
❌ Pas de shadows trop prononcées
❌ Pas de border-radius > 12px sur les cards
❌ Pas d'icônes avec fond coloré générique
❌ Pas de texte blanc pur (#FFF) sur noir pur (#000)
❌ Pas d'animations > 0.3s
❌ Pas de plus de 2 couleurs d'accent par page

✅ Dark mode profond partout
✅ Vert émeraude #10B981 comme seule couleur signature
✅ Typographie Geist avec hiérarchie claire
✅ Beaucoup d'espace négatif
✅ Bordures subtiles plutôt que shadows
✅ Scores et chiffres importants en Geist Mono
```

---

## 7. CLASSES UTILITAIRES (globals.css)

```css
.card         — card dark standard (bg #1A1A1F, border #2A2A32, radius 10px, p-5)
.card-hover   — card avec hover vert subtil
.badge        — badge générique (bg #1A1A1F, color #8B8B9E)
.badge-success — badge vert
.badge-warning — badge orange
.badge-danger  — badge rouge
.label-section — label de section (11px uppercase tracking-wide #55555F)
.btn-primary   — bouton primaire vert
.btn-secondary — bouton secondaire outline
.btn-ghost     — bouton ghost
.input-dark    — input dark standard
```
