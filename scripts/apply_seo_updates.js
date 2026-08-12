const fs = require("node:fs");
const path = require("node:path");
const siteConfig = require("../site.config.cjs");

const root = path.resolve(__dirname, "..");
const siteUrl = siteConfig.site.defaultOrigin.replace(/\/$/, "");
const bookingUrl = `${siteUrl}${siteConfig.site.bookingFallback}`;
const businessId = `${siteUrl}${siteConfig.properties.larDeVies.entityId}`;
const websiteId = `${siteUrl}/#website`;
const ruralPradoId = `${siteUrl}${siteConfig.properties.ruralPrado.entityId}`;
const biosphereUrl = "https://www.miteco.gob.es/es/parques-nacionales-oapn/reservas-biosfera-mab/programa-mab-espana/nuestras-reservas-de-la-biosfera/rioeooscosterrasburon.html";

// Metadatos públicos (ruta, title, description, imagen y lastModified) proceden
// siempre de site.config.cjs. Al construir `pages` solo se conservan de este
// overlay los detalles de Schema.org aún ausentes del manifiesto compartido.
const schemaOverlayDefaults = {
  "index.html": {
    route: "/",
    title: "Casa rural de lujo en A Pontenova, Lugo | Lar de Víes",
    description:
      "Suites y villas privadas en el Valle del Eo, entre Galicia y Asturias. Naturaleza, diseño y descanso en Lar de Víes. Reserva tu estancia.",
    ogTitle: "Lar de Víes | Casa rural de lujo en el Valle del Eo",
    image: "/images/home-hero-updated-desktop-2560.webp",
    imageAlt: "Lar de Víes y el paisaje del Valle del Eo",
    name: "Lar de Víes",
    type: "home",
    lastModified: "2026-07-23",
  },
  "LaCasona.html": {
    route: "/la-casona/",
    title: "Suites rurales en A Pontenova, Lugo | La Casona",
    description:
      "Cinco suites con personalidad propia en una casona gallega del siglo XVIII restaurada en el Valle del Eo. Descubre La Casona de Lar de Víes.",
    ogTitle: "La Casona | Suites rurales en el Valle del Eo",
    image: "/images/la-casona-hero-desktop-opt-v2.webp",
    imageAlt: "La Casona histórica de Lar de Víes rodeada de naturaleza",
    name: "La Casona",
    type: "collection",
    collection: "suites",
    lastModified: "2026-07-23",
  },
  "Lasvillas.html": {
    route: "/las-villas-casitas-independientes/",
    title: "Villas rurales privadas en Lugo | Lar de Víes",
    description:
      "Tres villas rurales independientes con jardín, cocina y vistas al Valle del Eo. Privacidad y naturaleza en A Pontenova, Lugo.",
    ogTitle: "Las Villas | Casas rurales privadas en Lugo",
    image: "/images/las-villas-hero-desktop-opt-v2.webp",
    imageAlt: "Villas privadas de Lar de Víes integradas en el paisaje gallego",
    name: "Las Villas",
    type: "collection",
    collection: "villas",
    lastModified: "2026-07-23",
  },
  "OtrosAlojamientos.html": {
    route: "/rural-prado/",
    title: "Rural Prado | Alojamientos rurales en Asturias",
    description:
      "Rural Prado es un complejo de alojamientos rurales restaurado en piedra y pizarra a orillas del río Eo, en San Tirso de Abres, Asturias.",
    ogTitle: "Rural Prado | Apartamentos rurales en Asturias",
    image: "/images/AMEIRO/AMEIRO1.jpeg",
    imageAlt: "Interior del apartamento Ameiro en Rural Prado",
    name: "Rural Prado",
    type: "ruralProperty",
    aboutId: ruralPradoId,
    socialSiteName: "Rural Prado",
    lastModified: "2026-08-11",
  },
  "zonas-comunes.html": {
    route: "/zonas-comunes/",
    title: "Zonas comunes de Lar de Víes | A Pontenova",
    description:
      "Conoce las zonas comunes de Lar de Víes: comedor, zona de café, televisión, sofás, mesas, Wi-Fi, aseo común y espacios para no fumadores.",
    ogTitle: "Zonas comunes | Lar de Víes",
    image: "/images/la-casona-corazon-tradicion.webp",
    imageAlt: "La Casona de Lar de Víes",
    name: "Zonas comunes",
    type: "facilities",
    lastModified: "2026-08-11",
  },
  "Entorno.html": {
    route: "/el-entorno/",
    title: "Río Eo, Oscos y Terras de Burón | Lar de Víes",
    description:
      "Rutas, bosques, cascadas y patrimonio cerca de Lar de Víes, en la Reserva de la Biosfera Río Eo, Oscos y Terras de Burón.",
    ogTitle: "El Entorno | Río Eo, Oscos y Terras de Burón",
    image: "/images/entorno-hero-desktop-opt-v2.webp",
    imageAlt: "Paisaje natural de la Reserva de la Biosfera Río Eo, Oscos y Terras de Burón",
    name: "El Entorno",
    type: "destination",
    lastModified: "2026-08-11",
  },
  "Reserva.html": {
    route: "/reservas/",
    title: "Reservar alojamiento rural en Lugo | Lar de Víes",
    description:
      "Reserva directamente tu suite o villa en Lar de Víes, A Pontenova. Consulta disponibilidad y disfruta de la mejor tarifa disponible.",
    ogTitle: "Reservas | Lar de Víes",
    image: "/images/reserva-hero-v2.webp",
    imageAlt: "Paisaje verde del Valle del Eo junto a Lar de Víes",
    name: "Reservas",
    type: "booking",
    lastModified: "2026-07-23",
  },
  "sobre-nosotros.html": {
    route: "/sobre-nosotros/",
    title: "Historia de Lar de Víes | Casa rural en Lugo",
    description:
      "Conoce el proyecto familiar que recuperó una casona gallega del siglo XVIII en Neipín y creó Lar de Víes, un refugio rural en el Valle del Eo.",
    ogTitle: "Sobre Lar de Víes | Historia y hospitalidad rural",
    image: "/images/sobre-nosotros-poster.webp",
    imageAlt: "Casona de piedra restaurada de Lar de Víes",
    name: "Sobre nosotros",
    type: "about",
    lastModified: "2026-07-23",
  },
  "suites/la-panera.html": {
    route: "/suite-la-panera/",
    title: "Suite La Panera en A Pontenova, Lugo | Lar de Víes",
    description:
      "Suite rural para hasta 4 personas con vistas al Valle del Eo, zona de estar y cama con dosel en La Casona de Lar de Víes.",
    ogTitle: "Suite La Panera | Lar de Víes",
    image: "/images/Panera/panera-1.webp",
    imageAlt: "Suite La Panera con vistas al Valle del Eo",
    name: "Suite La Panera",
    type: "suite",
    occupancy: 4,
    bed: "Cama king size o dos camas",
    lastModified: "2026-07-23",
  },
  "suites/el-cabozo.html": {
    route: "/suite-el-cabozo/",
    title: "Suite El Cabozo en A Pontenova, Lugo | Lar de Víes",
    description:
      "Suite rural para hasta 3 personas, con madera original, baño con vistas al valle y ambiente acogedor en La Casona de Lar de Víes.",
    ogTitle: "Suite El Cabozo | Lar de Víes",
    image: "/images/El%20cabozo/cabozo-1.webp",
    imageAlt: "Interior de la Suite El Cabozo en Lar de Víes",
    name: "Suite El Cabozo",
    type: "suite",
    occupancy: 3,
    bed: "Cama king size o dos camas",
    lastModified: "2026-07-23",
  },
  "suites/la-capilla.html": {
    route: "/suite-la-capilla/",
    title: "Suite La Capilla en A Pontenova, Lugo | Lar de Víes",
    description:
      "Suite rural para hasta 4 personas, distribuida en varias alturas junto a la Capilla de Santa Apolonia, en La Casona de Lar de Víes.",
    ogTitle: "Suite La Capilla | Lar de Víes",
    image: "/images/Capilla/capilla-1.webp",
    imageAlt: "Suite La Capilla en la casona histórica de Lar de Víes",
    name: "Suite La Capilla",
    type: "suite",
    occupancy: 4,
    bed: "Cama king size o dos camas",
    lastModified: "2026-07-23",
  },
  "suites/el-valle.html": {
    route: "/suite-el-valle/",
    title: "Suite El Valle en A Pontenova, Lugo | Lar de Víes",
    description:
      "Suite rural para hasta 4 personas inspirada en los hórreos gallegos, con claraboyas y vistas al paisaje del Valle del Eo.",
    ogTitle: "Suite El Valle | Lar de Víes",
    image: "/images/Valle/valle-1.webp",
    imageAlt: "Suite El Valle con vistas panorámicas en Lar de Víes",
    name: "Suite El Valle",
    type: "suite",
    occupancy: 4,
    bed: "Cama king size o dos camas",
    lastModified: "2026-07-23",
  },
  "suites/el-jardin.html": {
    route: "/suite-el-jardin/",
    title: "Suite El Jardín en A Pontenova, Lugo | Lar de Víes",
    description:
      "Suite rural adaptada para hasta 4 personas, con zona de estar y acceso directo al exterior de La Casona de Lar de Víes.",
    ogTitle: "Suite El Jardín | Lar de Víes",
    image: "/images/Jardin/jardin-2.webp",
    imageAlt: "Suite El Jardín con acceso directo al exterior",
    name: "Suite El Jardín",
    type: "suite",
    occupancy: 4,
    bed: "Cama king size o dos camas",
    accessible: true,
    lastModified: "2026-07-23",
  },
  "villas/el-camino.html": {
    route: "/villa-el-camino/",
    title: "Villa El Camino en A Pontenova, Lugo | Lar de Víes",
    description:
      "Villa rural para hasta 5 personas con dormitorio, cocina, chimenea, porche y jardín privado con vistas al Valle del Eo.",
    ogTitle: "Villa El Camino | Lar de Víes",
    image: "/images/Camino/camino-1.webp",
    imageAlt: "Villa El Camino con vistas al Valle del Eo",
    name: "Villa El Camino",
    type: "villa",
    occupancy: 5,
    bed: "Cama king size y sofá cama",
    lastModified: "2026-07-23",
  },
  "villas/camelia.html": {
    route: "/villa-camelia/",
    title: "Villa Camelia en A Pontenova, Lugo | Lar de Víes",
    description:
      "Villa rural para hasta 4 personas con cocina, porche acristalado y jardín privado rodeado de naturaleza en el Valle del Eo.",
    ogTitle: "Villa Camelia | Lar de Víes",
    image: "/images/Camelia/camelia-1.webp",
    imageAlt: "Villa Camelia rodeada de bosque en Lar de Víes",
    name: "Villa Camelia",
    type: "villa",
    occupancy: 4,
    bed: "Cama king size y sofá cama",
    lastModified: "2026-07-23",
  },
  "villas/jazmin.html": {
    route: "/villa-jazmin/",
    title: "Villa Jazmín en A Pontenova, Lugo | Lar de Víes",
    description:
      "Villa rural para hasta 4 personas con cocina, porche, jardín aromático privado y vistas abiertas al Valle del Eo.",
    ogTitle: "Villa Jazmín | Lar de Víes",
    image: "/images/Jazmin/jazmin-1.webp",
    imageAlt: "Villa Jazmín con jardín privado en Lar de Víes",
    name: "Villa Jazmín",
    type: "villa",
    occupancy: 4,
    bed: "Cama king size y sofá cama",
    lastModified: "2026-07-23",
  },
  "politica-de-privacidad.html": {
    route: "/politica-privacidad/",
    title: "Política de privacidad | Lar de Víes",
    description:
      "Información sobre privacidad y tratamiento de datos personales en el sitio web de Lar de Víes.",
    ogTitle: "Política de privacidad | Lar de Víes",
    image: "/images/home-hero-updated-desktop-2560.webp",
    imageAlt: "Lar de Víes",
    name: "Política de privacidad",
    type: "legal",
    robots: "noindex, follow",
    lastModified: "2026-07-23",
  },
  "aviso-legal.html": {
    route: "/aviso-legal/",
    title: "Aviso legal y condiciones de uso | Lar de Víes",
    description:
      "Información sobre la titularidad, responsabilidad y condiciones de uso aplicables al sitio web de Lar de Víes.",
    ogTitle: "Aviso legal | Lar de Víes",
    image: "/images/home-hero-updated-desktop-2560.webp",
    imageAlt: "Lar de Víes",
    name: "Aviso legal",
    type: "legal",
    robots: "noindex, follow",
    lastModified: "2026-07-23",
  },
};

const manifestSources = new Set(siteConfig.pages.map((page) => page.source));
for (const source of Object.keys(schemaOverlayDefaults)) {
  if (!manifestSources.has(source)) {
    throw new Error(`Página SEO ausente en site.config.cjs: ${source}`);
  }
}

const metadataKeys = new Set([
  "route",
  "title",
  "description",
  "ogTitle",
  "image",
  "imageAlt",
  "lastModified",
]);
const pages = Object.fromEntries(
  siteConfig.pages.map((manifestPage) => {
    const defaults = schemaOverlayDefaults[manifestPage.source];
    if (!defaults) {
      throw new Error(
        `Falta configuración de schema para ${manifestPage.source}`,
      );
    }
    const schemaDefaults = Object.fromEntries(
      Object.entries(defaults).filter(([key]) => !metadataKeys.has(key)),
    );
    const page = { ...schemaDefaults, ...manifestPage };
    if (manifestPage.indexable === false) page.robots = "noindex, follow";
    return [manifestPage.source, page];
  }),
);

const routeLinks = [
  [/(?:\.\.\/)?(?:suites\/)?la-panera\.html/g, "/suite-la-panera/"],
  [/(?:\.\.\/)?(?:suites\/)?el-cabozo\.html/g, "/suite-el-cabozo/"],
  [/(?:\.\.\/)?(?:suites\/)?la-capilla\.html/g, "/suite-la-capilla/"],
  [/(?:\.\.\/)?(?:suites\/)?el-valle\.html/g, "/suite-el-valle/"],
  [/(?:\.\.\/)?(?:suites\/)?el-jardin\.html/g, "/suite-el-jardin/"],
  [/(?:\.\.\/)?(?:villas\/)?el-camino\.html/g, "/villa-el-camino/"],
  [/(?:\.\.\/)?(?:villas\/)?camelia\.html/g, "/villa-camelia/"],
  [/(?:\.\.\/)?(?:villas\/)?jazmin\.html/g, "/villa-jazmin/"],
  [/(?:\.\.\/)?LaCasona\.html/g, "/la-casona/"],
  [/(?:\.\.\/)?Lasvillas\.html/g, "/las-villas-casitas-independientes/"],
  [/(?:\.\.\/)?OtrosAlojamientos\.html/g, "/rural-prado/"],
  [/(?:\.\.\/)?zonas-comunes\.html/g, "/zonas-comunes/"],
  [/\/otros-alojamientos\//g, "/rural-prado/"],
  [/(?:\.\.\/)?Entorno\.html/g, "/el-entorno/"],
  [/(?:\.\.\/)?Reserva\.html/g, "/reservas/"],
  [/(?:\.\.\/)?sobre-nosotros\.html/g, "/sobre-nosotros/"],
  [/(?:\.\.\/)?politica-de-privacidad\.html/g, "/politica-privacidad/"],
  [/(?:\.\.\/)?aviso-legal\.html/g, "/aviso-legal/"],
  [/(?:\.\.\/)?index\.html/g, "/"],
];

const suites = Object.values(pages).filter((page) => page.type === "suite");
const villas = Object.values(pages).filter((page) => page.type === "villa");

function absolute(route) {
  return `${siteUrl}${route}`;
}

function breadcrumb(items) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absolute(items.at(-1).route)}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolute(item.route),
    })),
  };
}

function commonWebPage(page, schemaType = "WebPage") {
  return {
    "@type": schemaType,
    "@id": `${absolute(page.route)}#webpage`,
    url: absolute(page.route),
    name: page.title,
    description: page.description,
    inLanguage: "es-ES",
    dateModified: page.lastModified,
    isPartOf: { "@id": websiteId },
    about: { "@id": page.aboutId || businessId },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absolute(page.image),
    },
  };
}

function structuredData(page) {
  if (page.type === "legal") return null;

  if (page.type === "home") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": websiteId,
          url: `${siteUrl}/`,
          name: "Lar de Víes",
          inLanguage: "es-ES",
          publisher: { "@id": businessId },
        },
        {
          "@type": "LodgingBusiness",
          "@id": businessId,
          name: "Lar de Víes",
          description: page.description,
          url: `${siteUrl}/`,
          logo: `${siteUrl}/images/logo%20sin%20fondo.png`,
          image: [
            absolute(page.image),
            `${siteUrl}/images/la-casona-hero-desktop-opt-v2.webp`,
            `${siteUrl}/images/las-villas-hero-desktop-opt-v2.webp`,
          ],
          telephone: "+34678655303",
          email: "reservas@lardevies.com",
          identifier: {
            "@type": "PropertyValue",
            propertyID: "Registro de Turismo",
            value: "TR-LU-000310",
          },
          address: {
            "@type": "PostalAddress",
            streetAddress: "Neipín, 4",
            addressLocality: "A Pontenova",
            addressRegion: "Lugo",
            postalCode: "27721",
            addressCountry: "ES",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: 43.3255,
            longitude: -7.1626,
          },
          hasMap: "https://maps.google.com/?q=43.3255,-7.1626",
          priceRange: "€€€",
          amenityFeature: [
            {
              "@type": "LocationFeatureSpecification",
              name: "Wi-Fi",
              value: true,
            },
            {
              "@type": "LocationFeatureSpecification",
              name: "Aparcamiento privado",
              value: true,
            },
            {
              "@type": "LocationFeatureSpecification",
              name: "Entorno natural",
              value: true,
            },
          ],
          sameAs: [
            "https://www.instagram.com/lardevies",
            "https://www.facebook.com/lardevies/",
          ],
          containsPlace: [...suites, ...villas].map((item) => ({
            "@id": `${absolute(item.route)}#accommodation`,
          })),
        },
        {
          ...commonWebPage(page),
          "@id": `${siteUrl}/#webpage`,
        },
      ],
    };
  }

  const crumbs = [{ name: "Inicio", route: "/" }];
  if (page.type === "suite") {
    crumbs.push({ name: "La Casona", route: pages["LaCasona.html"].route });
  }
  if (page.type === "villa") {
    crumbs.push({ name: "Las Villas", route: pages["Lasvillas.html"].route });
  }
  crumbs.push({ name: page.name, route: page.route });

  const graph = [commonWebPage(page, page.type === "about" ? "AboutPage" : "WebPage"), breadcrumb(crumbs)];

  if (page.type === "ruralProperty") {
    const apartmentsId = `${absolute(page.route)}#apartments`;
    graph[0].mainEntity = { "@id": ruralPradoId };
    graph.push(
      {
        "@type": "LodgingBusiness",
        "@id": ruralPradoId,
        name: "Rural Prado",
        url: absolute(page.route),
        description:
          "Alojamientos rurales restaurados en piedra y pizarra a orillas del río Eo, en San Tirso de Abres, Asturias.",
        image: absolute(page.image),
        potentialAction: {
          "@type": "ReserveAction",
          target: bookingUrl,
        },
      },
      {
        "@type": "ItemList",
        "@id": apartmentsId,
        name: "Apartamentos de Rural Prado",
        about: { "@id": ruralPradoId },
        numberOfItems: 5,
        itemListElement: ["Ameiro", "Salgueiro", "Castañeiro", "Bidueira", "Carballo"].map(
          (name, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name,
          }),
        ),
      },
    );
  }

  if (page.type === "facilities") {
    const facilitiesId = `${absolute(page.route)}#facilities`;
    graph[0].mainEntity = { "@id": facilitiesId };
    graph.push({
      "@type": "ItemList",
      "@id": facilitiesId,
      name: "Servicios comunes de Lar de Víes",
      numberOfItems: 8,
      itemListElement: [
        "Zona de comedor",
        "Zona de café",
        "Televisión",
        "Sofás",
        "Wi-Fi",
        "Mesas",
        "Espacio para no fumadores",
        "Aseo común",
      ].map((name, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
      })),
    });
  }

  if (page.type === "suite" || page.type === "villa") {
    const accommodation = {
      "@type": page.type === "suite" ? "HotelRoom" : "Accommodation",
      "@id": `${absolute(page.route)}#accommodation`,
      name: page.name,
      description: page.description,
      url: absolute(page.route),
      image: absolute(page.image),
      occupancy: {
        "@type": "QuantitativeValue",
        maxValue: page.occupancy,
        unitText: "personas",
      },
      bed: {
        "@type": "BedDetails",
        typeOfBed: page.bed,
      },
      amenityFeature: [
        {
          "@type": "LocationFeatureSpecification",
          name: "Wi-Fi",
          value: true,
        },
        {
          "@type": "LocationFeatureSpecification",
          name: "Baño privado",
          value: true,
        },
      ],
      containedInPlace: { "@id": businessId },
      potentialAction: {
        "@type": "ReserveAction",
        target: bookingUrl,
      },
    };
    if (page.type === "villa") {
      accommodation.numberOfBedrooms = 1;
      accommodation.petsAllowed = true;
      accommodation.amenityFeature.push(
        {
          "@type": "LocationFeatureSpecification",
          name: "Cocina equipada",
          value: true,
        },
        {
          "@type": "LocationFeatureSpecification",
          name: "Jardín privado",
          value: true,
        },
      );
    }
    if (page.accessible) {
      accommodation.amenityFeature.push({
        "@type": "LocationFeatureSpecification",
        name: "Baño adaptado",
        value: true,
      });
    }
    graph[0].mainEntity = { "@id": accommodation["@id"] };
    graph.push(accommodation);
  }

  if (page.type === "collection") {
    const items = page.collection === "suites" ? suites : villas;
    graph.push({
      "@type": "ItemList",
      "@id": `${absolute(page.route)}#accommodations`,
      name: page.name,
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absolute(item.route),
      })),
    });
  }

  if (page.type === "destination") {
    graph.push({
      "@type": "TouristDestination",
      "@id": `${absolute(page.route)}#destination`,
      name: "Reserva de la Biosfera Río Eo, Oscos y Terras de Burón",
      description:
        "Reserva de la Biosfera transfronteriza entre Galicia y Asturias, con rutas, bosques, cascadas y patrimonio en el entorno de Lar de Víes.",
      sameAs: biosphereUrl,
      touristType: ["Turismo rural", "Senderismo", "Naturaleza"],
    });
  }

  if (page.type === "booking") {
    graph[0].potentialAction = {
      "@type": "ReserveAction",
      target: bookingUrl,
      object: { "@id": businessId },
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function replaceLinkTargets(html) {
  return html.replace(/href="([^"]+)"/g, (full, value) => {
    let next = value;
    for (const [pattern, destination] of routeLinks) {
      next = next.replace(pattern, destination);
    }
    return `href="${next}"`;
  });
}

function disableUnavailableLanguage(html, language, title) {
  const pattern = new RegExp(
    `<a\\b([^>]*)>((?:(?!<\\/a>)[\\s\\S])*?\\b${language}\\b(?:(?!<\\/a>)[\\s\\S])*)<\\/a>`,
    "g",
  );
  return html.replace(pattern, (_match, attributes, inner) => {
    const cleanAttributes = attributes
      .replace(/\s+href="[^"]*"/i, "")
      .replace(/\s+aria-current="[^"]*"/i, "");
    return `<span${cleanAttributes} aria-disabled="true" title="${title}">${inner}</span>`;
  });
}

function updateHtml(file, page) {
  const fullPath = path.join(root, file);
  let html = fs.readFileSync(fullPath, "utf8");
  html = replaceLinkTargets(html);
  html = disableUnavailableLanguage(html, "English", "Versión en inglés próximamente");
  html = disableUnavailableLanguage(html, "Deutsch", "Versión en alemán próximamente");
  html = html.replace(
    /<a\b([^>]*)>\s*(EN|DE)\s*<\/a>/g,
    (_match, attributes, language) => {
      const cleanAttributes = attributes
        .replace(/\s+href="[^"]*"/i, "")
        .replace(/\s+aria-current="[^"]*"/i, "");
      const title =
        language === "EN"
          ? "Versión en inglés próximamente"
          : "Versión en alemán próximamente";
      return `<span${cleanAttributes} aria-disabled="true" title="${title}">${language}</span>`;
    },
  );

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${page.title}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[\s\S]*?">/i,
    `<meta name="description" content="${page.description}">`,
  );
  html = html.replace(/\s*<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/gi, "");
  const robots =
    page.robots ||
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  html = html.replace(
    /(<meta\s+name="description"\s+content="[\s\S]*?">)/i,
    `$1\n    <meta name="robots" content="${robots}">`,
  );

  const canonical = absolute(page.route);
  if (/<link\s+rel="canonical"/i.test(html)) {
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${canonical}">`,
    );
  } else {
    html = html.replace(
      /(<meta\s+name="robots"\s+content="[^"]*">)/i,
      `$1\n    <link rel="canonical" href="${canonical}">`,
    );
  }

  const socialBlock = `    <!-- Open Graph -->\n` +
    `    <meta property="og:title" content="${page.ogTitle}">\n` +
    `    <meta property="og:description" content="${page.description}">\n` +
    `    <meta property="og:type" content="website">\n` +
    `    <meta property="og:url" content="${canonical}">\n` +
    `    <meta property="og:image" content="${absolute(page.image)}">\n` +
    `    <meta property="og:image:alt" content="${page.imageAlt}">\n` +
    `    <meta property="og:locale" content="es_ES">\n` +
    `    <meta property="og:site_name" content="${page.socialSiteName || "Lar de Víes"}">\n\n` +
    `    <!-- Twitter Card -->\n` +
    `    <meta name="twitter:card" content="summary_large_image">\n` +
    `    <meta name="twitter:title" content="${page.ogTitle}">\n` +
    `    <meta name="twitter:description" content="${page.description}">\n` +
    `    <meta name="twitter:image" content="${absolute(page.image)}">\n` +
    `    <meta name="twitter:image:alt" content="${page.imageAlt}">\n\n`;

  html = html.replace(
    /\s*<!-- Open Graph -->[\s\S]*?(?=\s*<!-- Favicon -->)/i,
    `\n\n${socialBlock}`,
  );

  html = html.replace(
    /\s*<!-- Schema\.org LocalBusiness[\s\S]*?<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
    "",
  );
  html = html.replace(
    /\s*<!-- SEO Structured Data -->\s*<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
    "",
  );
  const schema = structuredData(page);
  if (schema) {
    const schemaBlock =
      `\n    <!-- SEO Structured Data -->\n` +
      `    <script type="application/ld+json">\n` +
      `${JSON.stringify(schema, null, 2)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")}\n` +
      `    </script>\n`;
    html = html.replace(/\s*<\/head>/i, `${schemaBlock}</head>`);
  }

  fs.writeFileSync(fullPath, html, "utf8");
}

for (const [file, page] of Object.entries(pages)) {
  updateHtml(file, page);
}

const sitemapPages = Object.values(pages).filter((page) => page.indexable !== false);
for (const page of sitemapPages) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(page.lastModified)) {
    throw new Error(`lastModified ausente o inválido para ${page.route}`);
  }
}
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemapPages
    .map(
      (page) =>
        `  <url>\n` +
        `    <loc>${absolute(page.route)}</loc>\n` +
        `    <lastmod>${page.lastModified}</lastmod>\n` +
        `  </url>`,
    )
    .join("\n") +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap, "utf8");

const robots =
  `# Robots.txt de Lar de Víes\n` +
  `# Rastreo para buscadores y respuestas solicitadas por usuarios.\n` +
  `User-agent: Googlebot\n` +
  `User-agent: Bingbot\n` +
  `User-agent: OAI-SearchBot\n` +
  `User-agent: ChatGPT-User\n` +
  `User-agent: Claude-SearchBot\n` +
  `User-agent: Claude-User\n` +
  `User-agent: PerplexityBot\n` +
  `User-agent: Perplexity-User\n` +
  `Allow: /\n` +
  `Disallow: /audit-design-2026-07-23/\n` +
  `Disallow: /Skills/\n` +
  `Disallow: /scripts/\n\n` +
  `# Exclusión de rastreadores destinados al entrenamiento de modelos.\n` +
  `User-agent: GPTBot\n` +
  `Disallow: /\n\n` +
  `User-agent: ClaudeBot\n` +
  `Disallow: /\n\n` +
  `User-agent: *\n` +
  `Allow: /\n` +
  `Disallow: /audit-design-2026-07-23/\n` +
  `Disallow: /Skills/\n` +
  `Disallow: /scripts/\n\n` +
  `Sitemap: ${siteUrl}/sitemap.xml\n`;
fs.writeFileSync(path.join(root, "robots.txt"), robots, "utf8");

console.log(`SEO actualizado en ${Object.keys(pages).length} páginas.`);
