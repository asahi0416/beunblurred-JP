import { requestAuthenticated } from "@/utils/requests";
import clientPromise from "@/utils/mongo";
import checkAuth from "@/utils/checkAuth";
import Stripe from "stripe";

import { getCookie } from "cookies-next";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const client = await clientPromise;
    const db = client.db("beunblurred");
    const users = db.collection("users");

    const authCheck = await checkAuth(req, res);
    if (authCheck) return res.status(401).json({ message: "Unauthorized" });

    const user = await requestAuthenticated("person/me", req, res);

    const userFromDb = await users.findOne({ id: user.data.id });

    if (!userFromDb) {
        return res.status(404).json({ message: "User doesn't exist" });
    }

    const stripe = Stripe(process.env.STRIPE_API_KEY);
    const session = await stripe.checkout.sessions.create({
        customer: userFromDb.stripeCustomerId,
        line_items: [
            {
                price: process.env.STRIPE_PRODUCT_ID,
                quantity: 1,
            },
        ],
        mode: "subscription",
        success_url: "http://localhost:3000/archiver/load",
        cancel_url: "http://localhost:3000/archiver",
    });

    res.status(200).redirect(session.url);
}