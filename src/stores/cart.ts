import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: string;
  /** URL slug, so the cart can link back to the book page (`/books/[slug]`). */
  slug?: string;
  title: string;
  author: string;
  priceCents: number;
  coverPath: string | null;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
};

/**
 * Client-side cart.
 *
 * IMPORTANT: prices stored here are only for display. The checkout route always
 * re-reads the catalogue and recomputes the total server-side, so a tampered
 * localStorage entry can never change what PayPal is asked to charge.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((entry) => entry.id === item.id);
          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.id === item.id
                  ? { ...entry, quantity: Math.min(entry.quantity + quantity, 10) }
                  : entry,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: Math.min(quantity, 10) }] };
        });
      },
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQty: (id, qty) => {
        if (qty < 1) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, quantity: Math.min(qty, 10) } : i)),
        }));
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: "lumen-books-cart",
      version: 1,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

/** Total number of books in the cart. Derived, so it is never stored. */
export const selectCartCount = (state: CartState) =>
  state.items.reduce((total, item) => total + item.quantity, 0);

/** Display-only subtotal. The server recomputes the real one. */
export const selectCartSubtotal = (state: CartState) =>
  state.items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
