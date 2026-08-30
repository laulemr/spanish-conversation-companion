// Content boundary for each unit — the ONLY topics, vocabulary, and grammar
// patterns the conversation companion is allowed to draw on. Sourced from the
// "Campus Difusión" units 0-6 the instructor uses in class.

export const UNITS = {
  0: {
    title: 'Gente en clase',
    summary: 'Saludar y despedirse; decir tu nombre y tu lugar de origen; preguntas básicas para pedir aclaraciones en clase; presentarte con datos sencillos (ciudad, palabra en español, escritor/a, cantante o grupo, serie de TV, director/a de cine, canción favorita).',
    patterns: [
      'Saludos y despedidas: Hola, ¿qué tal?, Adiós, Hasta luego',
      'Me llamo... / Soy de...',
      'Preguntas de control de la comunicación: ¿Cómo? ¿Perdón? ¿Qué significa...? ¿Cómo se dice...? ¿Cómo se escribe...?',
      'Presentarse con gustos culturales sencillos: Un/a escritor/a es..., Una canción es..., Una serie de TV es...'
    ]
  },
  1: {
    title: 'Gente que estudia español',
    summary: 'Números del 0 al 20; el alfabeto y deletrear; países de habla hispana y sus capitales; dar un número de teléfono o un correo electrónico; expresar intereses culturales; hablar, de forma respetuosa y sin generalizar, sobre estereotipos culturales y los diferentes acentos del español.',
    patterns: [
      'Artículos determinados: el, la, los, las',
      'Concordancia de género y número',
      'Pronombres sujeto + presente de "ser" (soy, eres, es, somos, sois, son)',
      'Demostrativos: este/a/os/as, esto',
      'Sí / no',
      'Números 0-20; el alfabeto; ¿Cómo se escribe...? ¿Se escribe con...?',
      'Me interesa.../Me gusta... (intereses culturales)'
    ]
  },
  2: {
    title: 'Gente con gente',
    summary: 'Dar información personal sencilla de otra persona: nacionalidad, edad, estado civil, profesión; describir el carácter y el aspecto físico de alguien; hablar de relaciones familiares (padres, hermanos/as, hijos/as); dar una razón sencilla con "porque".',
    patterns: [
      'Presente regular de los tres grupos: -ar (trabajar), -er (leer), -ir (escribir)',
      'Género y número de los adjetivos (simpático/a, trabajador/a, alto/alta)',
      'Números del 20 al 100',
      '¿Cuántos años tiene/s? Tengo... años',
      'Relaciones familiares: mi padre/madre, mi hermano/a, mi hijo/a',
      'Explicar con "porque"'
    ]
  },
  3: {
    title: 'Gente de vacaciones',
    summary: 'Hablar de gustos, intereses y preferencias de viaje; coincidir o discrepar sobre gustos; describir un lugar y los servicios que tiene; planear unas vacaciones sencillas (adónde ir, cómo viajar, dónde alojarse).',
    patterns: [
      'Verbos gustar / interesar / querer / preferir (presente)',
      'Coincidir/discrepar: a mí sí, a mí no, a mí también, a mí tampoco',
      'Hay / está(n) / tiene(n) para hablar de lugares y servicios',
      'Preguntas con qué, quién, dónde, cuándo, cómo',
      'Conector "porque"'
    ]
  },
  4: {
    title: 'Gente de compras',
    summary: 'Ir de compras: describir y valorar objetos, preguntar y decir precios, hablar de ropa y colores, decir qué necesitas u obligación de hacer algo, elegir un regalo sencillo para alguien.',
    patterns: [
      'Números a partir de 100',
      '¿Cuánto cuesta/n...? Cuesta/n...',
      'Tener que + infinitivo (obligación); Poder + infinitivo',
      'Un / uno / una',
      'Pronombres de objeto directo (lo, la, los, las) e indirecto (le, les) en frases simples',
      'Demostrativos: este, esta, estos, estas, esto',
      'Colores y ropa'
    ]
  },
  5: {
    title: 'Gente en forma',
    summary: 'Vocabulario de partes del cuerpo, deporte, hábitos de sueño y alimentación como TEMA LINGÜÍSTICO del libro; describir con qué frecuencia se hacen actividades cotidianas; usar, únicamente como práctica de la estructura gramatical del libro (no como consejo real), frases de ejemplo con "es bueno / es importante / hay que + infinitivo".',
    patterns: [
      'Presente de indicativo regular e irregular (dormir, hacer, ir, dar)',
      'Verbos reflexivos: levantarse, ponerse, relajarse, ducharse, vestirse',
      'Expresiones de frecuencia: siempre, muchas veces, frecuentemente, de vez en cuando, nunca',
      'Cuantificadores: poco, un poco, bastante, lo suficiente, mucho, demasiado',
      'Vocabulario de deportes y partes del cuerpo',
      'IMPORTANTE: estas estructuras de recomendación se practican solo como ejemplos gramaticales del libro (p. ej. "Es bueno dormir bien", como en el libro), nunca como consejo de salud real dirigido al estudiante.'
    ]
  },
  6: {
    title: 'Gente que come bien',
    summary: 'Vocabulario de alimentos y productos típicos de España y Latinoamérica; hablar de las características de un plato; pesos y medidas sencillos; pedir en un restaurante; los pasos muy simples de una receta.',
    patterns: [
      'Forma impersonal con "se": se come, se pone, se corta, se mezcla',
      'Cantidades: poco, un poco de, suficiente, mucho, demasiado, ningún/ninguna, nada de',
      'Pesos y medidas: un kilo de, un cuarto de kilo de, una botella de',
      'Para el restaurante: ¿Qué van a tomar? De primero.../De postre...; ¿Algo más? La cuenta, por favor',
      'Vocabulario de alimentos comunes en la cocina española y latinoamericana'
    ]
  }
};
