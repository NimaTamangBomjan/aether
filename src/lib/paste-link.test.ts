import { describe, expect, it } from "vitest";
import { giftFromPastedLink } from "./paste-link";

describe("pasting a store link", () => {
  it("names the gift and the store from the web address", () => {
    expect(giftFromPastedLink("https://www.amazon.com/LEGO-Classic-Creative-Bricks-10692/dp/B00NHQFA1I?ref=abc")).toEqual({
      title: "LEGO Classic Creative Bricks 10692",
      link: "https://www.amazon.com/LEGO-Classic-Creative-Bricks-10692/dp/B00NHQFA1I?ref=abc",
      store: "Amazon",
    });
    expect(giftFromPastedLink("https://www.target.com/p/stanley-quencher-tumbler-40oz/-/A-87654321")).toMatchObject({
      title: "Stanley quencher tumbler 40oz",
      store: "Target",
    });
    expect(giftFromPastedLink("https://www.etsy.com/listing/123456789/handmade-wool-scarf-for-grandma")).toMatchObject({
      title: "Handmade wool scarf for grandma",
      store: "Etsy",
    });
    expect(giftFromPastedLink("https://www.bestbuy.co.uk/site/sony-wh-1000xm5-headphones/6505727.p")).toMatchObject({ store: "Best Buy", title: "Sony wh 1000xm5 headphones" });
  });

  it("still works when the address has no readable words", () => {
    expect(giftFromPastedLink("https://a.co/d/3xYz9Ab")).toEqual({ title: "Gift from Amazon", link: "https://a.co/d/3xYz9Ab", store: "Amazon" });
    expect(giftFromPastedLink("https://shop.example-boutique.com/item/42")).toMatchObject({ title: "Gift from Example-boutique" });
  });

  it("leaves ordinary gift names alone", () => {
    expect(giftFromPastedLink("Fleece vest")).toBeNull();
    expect(giftFromPastedLink("amazon.com/thing")).toBeNull();
    expect(giftFromPastedLink("https://example.com/a b")).toBeNull();
    expect(giftFromPastedLink("javascript:alert(1)")).toBeNull();
  });
});
