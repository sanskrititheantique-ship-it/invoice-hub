// Business and invoice-series configuration. Add a business here and it appears everywhere.

export type Preset = { id: string; label: string; hsn: string; gst?: number; apparel?: boolean; unit?: string };
export type SeriesField = "channel" | "shipTo" | "shipping" | "provenance" | "enroll" | "project" | "seller";
export type Series = {
  code: string; // 3 letters. Credit notes use code + "C" (e.g. VYRC)
  label: string;
  kind: "goods" | "services";
  priceMode: "inclusive" | "exclusive";
  defaultStatus: "issued" | "paid";
  fields: SeriesField[];
  channels?: string[];
  paymentModes: string[];
  refLabel: string;
  itemHead: string;
  notePh: string;
  labels?: { customer?: string; name?: string };
  presets: Preset[];
};
export type BusinessDefaults = {
  legalName: string; tradeName: string; stateCode: string; address: string;
  website?: string; email?: string; phone?: string; terms?: string;
};
export type Brand = {
  key: string;
  name: string;
  template: "vy" | "dt" | "lc" | "st";
  business: BusinessDefaults;
  series: Series[];
};

export const UNITS = ["Nos", "Pcs", "Set", "Pair", "Box", "Seat", "Course", "Hrs", "Month", "Project", "Lot"];

export const BRANDS: Brand[] = [
  {
    key: "vyrelle", name: "Vyrelle", template: "vy",
    business: { legalName: "Deepanshu Empire", tradeName: "Vyrelle", stateCode: "09", address: "Meerut, Uttar Pradesh", website: "vyrelle.in", email: "team@vyrelle.in",
      terms: "Returns are accepted within 3 days of delivery as per the Vyrelle returns policy.\nSubject to Meerut jurisdiction." },
    series: [{
      code: "VYR", label: "Tax invoice", kind: "goods", priceMode: "inclusive", defaultStatus: "paid",
      fields: ["channel", "shipTo", "shipping"],
      channels: ["Website", "Amazon", "Flipkart", "Meesho", "Instagram", "WhatsApp", "Offline / exhibition"],
      paymentModes: ["Razorpay (online)", "Cash on delivery", "UPI", "Marketplace payout", "Cash", "Card"],
      refLabel: "Payment / transaction ID", itemHead: "Pieces", notePh: "Colour, size, variant",
      presets: [
        { id: "candle", label: "Candles · 3406 · 5%", hsn: "3406", gst: 5, unit: "Pcs" },
        { id: "apparel", label: "Women's apparel · 6204 · 5% up to ₹2,500, else 18%", hsn: "6204", apparel: true, unit: "Pcs" },
        { id: "inner", label: "Innerwear · 6212 · 5% up to ₹2,500, else 18%", hsn: "6212", apparel: true, unit: "Pcs" },
        { id: "jewel", label: "Imitation jewellery · 7117 · 3%", hsn: "7117", gst: 3, unit: "Pcs" },
        { id: "wood", label: "Home décor, wooden handicraft · 4420 · 5%", hsn: "4420", gst: 5, unit: "Pcs" },
        { id: "brass", label: "Home décor, brass statuette · 8306 · 5%", hsn: "8306", gst: 5, unit: "Pcs" },
        { id: "kitchen", label: "Kitchenware, steel · 7323 · 5%", hsn: "7323", gst: 5, unit: "Pcs" },
        { id: "gen18", label: "Other goods · 18%", hsn: "", gst: 18, unit: "Pcs" },
      ],
    }],
  },
  {
    key: "dtlive", name: "DT.live", template: "dt",
    business: { legalName: "Deepanshu Empire", tradeName: "DT.live", stateCode: "09", address: "Meerut, Uttar Pradesh", website: "deepanshutyagi.live", email: "dtyagi.main@gmail.com", phone: "+91 79824 87638",
      terms: "Course access is personal and non-transferable.\nRefunds follow the Refund & Cancellation policy at deepanshutyagi.live/refund-policy." },
    series: [{
      code: "DTL", label: "Tax invoice", kind: "services", priceMode: "exclusive", defaultStatus: "paid",
      fields: ["enroll"], paymentModes: ["Razorpay", "UPI", "Bank transfer", "Card", "Cash"],
      refLabel: "Razorpay payment ID", itemHead: "Course / workshop", notePh: "e.g. 6 modules, lifetime access",
      labels: { customer: "Learner", name: "Learner name" },
      presets: [
        { id: "course", label: "Recorded course · SAC 999293 · 18%", hsn: "999293", gst: 18, unit: "Course" },
        { id: "workshop", label: "Live workshop seat · SAC 999293 · 18%", hsn: "999293", gst: 18, unit: "Seat" },
        { id: "mentor", label: "1:1 mentoring · SAC 999293 · 18%", hsn: "999293", gst: 18, unit: "Hrs" },
      ],
    }],
  },
  {
    key: "loudcousin", name: "loudcousin", template: "lc",
    business: { legalName: "Deepanshu Empire", tradeName: "LoudCousin", stateCode: "09", address: "Meerut, Uttar Pradesh", website: "loudcousin.com", email: "team@loudcousin.com", phone: "+91 98706 00903",
      terms: "Payment is due by the date shown.\nPlease quote the invoice number as the transfer reference." },
    series: [{
      code: "LCA", label: "Tax invoice", kind: "services", priceMode: "exclusive", defaultStatus: "issued",
      fields: ["project"], paymentModes: ["Bank transfer", "UPI", "Razorpay", "Card", "Wire transfer (international)", "Cash"],
      refLabel: "UTR / transaction ID", itemHead: "Services", notePh: "Scope, deliverables, period",
      presets: [
        { id: "web", label: "Website design & development · 998314 · 18%", hsn: "998314", gst: 18, unit: "Project" },
        { id: "ads", label: "Meta ads management · 998361 · 18%", hsn: "998361", gst: 18, unit: "Month" },
        { id: "social", label: "Instagram & content · 998361 · 18%", hsn: "998361", gst: 18, unit: "Month" },
        { id: "auto", label: "Automations & AI tools · 998314 · 18%", hsn: "998314", gst: 18, unit: "Project" },
        { id: "brand", label: "Logo & branding · 998391 · 18%", hsn: "998391", gst: 18, unit: "Project" },
        { id: "consult", label: "Consulting · 998311 · 18%", hsn: "998311", gst: 18, unit: "Hrs" },
      ],
    }],
  },
  {
    key: "sanskriti", name: "Sanskriti", template: "st",
    business: { legalName: "Jyoti Enterprises", tradeName: "Sanskriti The Antique", stateCode: "07", address: "Karawal Nagar, Delhi 110094", website: "sanskrititheantique.in", email: "teamsanskrititheantique@gmail.com", phone: "+91 99715 29900",
      terms: "Subject to Delhi jurisdiction." },
    series: [
      {
        code: "STE", label: "Seller enrollment", kind: "services", priceMode: "exclusive", defaultStatus: "issued",
        fields: ["seller"], paymentModes: ["UPI", "Bank transfer", "Razorpay", "Cash", "Card"],
        refLabel: "UTR / transaction ID", itemHead: "Plan & services", notePh: "Plan duration, inclusions",
        labels: { customer: "Enrolled seller", name: "Seller name" },
        presets: [
          { id: "enroll", label: "Seller enrollment / onboarding · 998599 · 18%", hsn: "998599", gst: 18, unit: "Nos" },
          { id: "train", label: "Seller training · 999293 · 18%", hsn: "999293", gst: 18, unit: "Nos" },
          { id: "listing", label: "Listing & catalog services · 998599 · 18%", hsn: "998599", gst: 18, unit: "Nos" },
          { id: "photo", label: "Product photography · 998386 · 18%", hsn: "998386", gst: 18, unit: "Nos" },
        ],
      },
      {
        code: "STS", label: "Product sale", kind: "goods", priceMode: "inclusive", defaultStatus: "paid",
        fields: ["channel", "shipTo", "shipping", "provenance"],
        channels: ["Amazon", "Website", "Instagram", "WhatsApp", "Offline / exhibition", "Other"],
        paymentModes: ["Marketplace payout", "Razorpay (online)", "UPI", "Cash on delivery", "Bank transfer", "Cash"],
        refLabel: "Payment / settlement ref", itemHead: "Items", notePh: "Material, era, size",
        presets: [
          { id: "antique", label: "Antique, over 100 years · 9706 · 5%", hsn: "9706", gst: 5, unit: "Pcs" },
          { id: "wood", label: "Wooden handicraft · 4420 · 5%", hsn: "4420", gst: 5, unit: "Pcs" },
          { id: "brass", label: "Brass / metal statuette · 8306 · 5%", hsn: "8306", gst: 5, unit: "Pcs" },
          { id: "painting", label: "Handmade painting · 9701 · 5%", hsn: "9701", gst: 5, unit: "Pcs" },
          { id: "saree", label: "Saree / handloom fabric · 5007 · 5%", hsn: "5007", gst: 5, unit: "Pcs" },
          { id: "gem", label: "Gemstone, cut · 7103 · 0.25%", hsn: "7103", gst: 0.25, unit: "Pcs" },
          { id: "jewel", label: "Imitation jewellery · 7117 · 3%", hsn: "7117", gst: 3, unit: "Pcs" },
          { id: "gen18", label: "Other goods · 18%", hsn: "", gst: 18, unit: "Pcs" },
        ],
      },
    ],
  },
];

export function brandOf(key: string): Brand | undefined {
  return BRANDS.find((b) => b.key === key);
}
export function seriesOf(brand: Brand, code: string): Series {
  return brand.series.find((s) => s.code === code) || brand.series[0];
}
export const has = (s: Series, f: SeriesField) => s.fields.includes(f);
