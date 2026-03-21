import ShopSOP from "../../models/shopSOP.js";

export const getSopForShop = async (shopId, organisation) => {
  const [globalDefault, shopOverride] = await Promise.all([
    ShopSOP.findOne({ shopId: null }).lean(),
    ShopSOP.findOne({ shopId }).lean(),
  ]);

  // fallback if no global default exists yet
  if (!globalDefault) {
    throw new Error("Global SOP default not seeded. Run the seeder first.");
  }

  const merged = {
    delivery: { ...globalDefault.delivery, ...shopOverride?.delivery },
    payment: { ...globalDefault.payment, ...shopOverride?.payment },
    shop: { ...globalDefault.shop, ...shopOverride?.shop },
    rules: { ...globalDefault.rules, ...shopOverride?.rules },
  };

  // pull shop name from Organisation — single source of truth
  merged.shop.name = organisation?.name ?? "the shop";

  return merged;
};
