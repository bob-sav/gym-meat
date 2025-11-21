// src/data/cutGuides.ts
export type SpeciesKey =
  | "BEEF"
  | "CHICKEN"
  | "TURKEY"
  | "DUCK"
  | "GOOSE"
  | "SALMON";
export type PartKey =
  | "SIRLOIN"
  | "TENDERLOIN"
  | "SHORT_LOIN"
  | "RUMP"
  | "RIBEYE"
  | "BREAST"
  | "THIGH"
  | "WHOLE_BIRD"
  | "FILLET";

export type CutGuide = {
  title: string;
  blurb?: string;
  imageUrl?: string;
  linkUrl?: string; // optional "see more" link (blog, recipe site, etc.)
  tips?: string[]; // quick bullets
};

export type GuideIndex = Partial<Record<PartKey, CutGuide>> & {
  __ANY__?: CutGuide;
}; // __ANY__ = species fallback

export const CUT_GUIDES: Record<SpeciesKey, GuideIndex> = {
  SALMON: {
    FILLET: {
      title: "Crisp-Skin Salmon Fillet",
      blurb:
        "Pat dry, season, and pan-sear skin-side down until glassy-crisp. Finish with butter and lemon.",
      imageUrl: "/images/guides/salmon-fillet.jpg",
      tips: [
        "Score skin lightly to prevent curling",
        "Medium heat → steady fat rendering",
        "Rest 2–3 min before serving",
      ],
      linkUrl: "https://www.gusto.at/themen/kochschule",
    },
    __ANY__: {
      title: "Salmon Basics",
      blurb:
        "Choose bright, firm flesh. Avoid overcooking; 50–52°C center for moist flakes.",
      imageUrl: "/images/guides/salmon-basics.jpg",
    },
  },

  // Stubs ready for later fill
  BEEF: {
    SIRLOIN: {
      title: "Sirloin Steak Recipe",
      blurb:
        "Sirloin Steak gets the royal treatment, first topped in mesquite seasoning and then finished with a delicious garlic herb butter sauce. The result is thick, juicy, moist, buttery, garlicky tender sirloin steak every time! ",
      imageUrl: "/images/guides/salmon-fillet.jpg",
      tips: [
        "Score skin lightly to prevent curling",
        "Medium heat → steady fat rendering",
        "Rest 2–3 min before serving",
      ],
      linkUrl: "https://www.gusto.at/themen/kochschule",
    },
    TENDERLOIN: {
      title: "Crisp-Skin Salmon Fillet",
      blurb:
        "Pat dry, season, and pan-sear skin-side down until glassy-crisp. Finish with butter and lemon.",
      imageUrl: "/images/guides/salmon-fillet.jpg",
      tips: [
        "Score skin lightly to prevent curling",
        "Medium heat → steady fat rendering",
        "Rest 2–3 min before serving",
      ],
      linkUrl: "https://www.gusto.at/themen/kochschule",
    },
    SHORT_LOIN: {
      title: "Crisp-Skin Salmon Fillet",
      blurb:
        "Pat dry, season, and pan-sear skin-side down until glassy-crisp. Finish with butter and lemon.",
      imageUrl: "/images/guides/salmon-fillet.jpg",
      tips: [
        "Score skin lightly to prevent curling",
        "Medium heat → steady fat rendering",
        "Rest 2–3 min before serving",
      ],
      linkUrl: "https://www.gusto.at/themen/kochschule",
    },
    RUMP: {
      title: "Crisp-Skin Salmon Fillet",
      blurb:
        "Pat dry, season, and pan-sear skin-side down until glassy-crisp. Finish with butter and lemon.",
      imageUrl: "/images/guides/salmon-fillet.jpg",
      tips: [
        "Score skin lightly to prevent curling",
        "Medium heat → steady fat rendering",
        "Rest 2–3 min before serving",
      ],
      linkUrl: "https://www.gusto.at/themen/kochschule",
    },
    RIBEYE: {
      title: "Crisp-Skin Salmon Fillet",
      blurb:
        "Pat dry, season, and pan-sear skin-side down until glassy-crisp. Finish with butter and lemon.",
      imageUrl: "/images/guides/salmon-fillet.jpg",
      tips: [
        "Score skin lightly to prevent curling",
        "Medium heat → steady fat rendering",
        "Rest 2–3 min before serving",
      ],
      linkUrl: "https://www.gusto.at/themen/kochschule",
    },
    __ANY__: {
      title: "Beef Basics",
      blurb: "Salt early, rest long, slice across grain.",
    },
  },
  CHICKEN: {
    __ANY__: {
      title: "Chicken Basics",
      blurb: "Dry skin + high heat for crisp.",
    },
  },
  TURKEY: { __ANY__: { title: "Turkey Basics" } },
  DUCK: { __ANY__: { title: "Duck Basics" } },
  GOOSE: { __ANY__: { title: "Goose Basics" } },
};
