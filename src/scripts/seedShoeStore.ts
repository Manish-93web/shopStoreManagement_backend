import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load models
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Inventory from '../models/Inventory.js';

dotenv.config();

const STORE_ID = '67d9492c9bc301ba3373111f'; // Identified store ID
const OWNER_ID = '67d9492c9bc301ba33731117'; // Identified owner ID

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Seed: Connected to MongoDB');

        // 1. Seed Categories
        const categories = await Category.insertMany([
            { name: 'Running Shoes', storeId: STORE_ID, description: 'Athletic performance shoes' },
            { name: 'Formal Shoes', storeId: STORE_ID, description: 'Elegant leather shoes for work and events' },
            { name: 'Sneakers', storeId: STORE_ID, description: 'Casual everyday comfort' },
        ]);
        console.log(`Seed: Added ${categories.length} categories`);

        // 2. Seed Brands
        const brands = await Brand.insertMany([
            { name: 'SportSync', storeId: STORE_ID, description: 'Premium athletic gear' },
            { name: 'UrbanStep', storeId: STORE_ID, description: 'Modern casual footwear' },
            { name: 'ClassicTread', storeId: STORE_ID, description: 'Traditional craftsmanship' },
        ]);
        console.log(`Seed: Added ${brands.length} brands`);

        // 3. Seed Suppliers
        const suppliers = await Supplier.insertMany([
            { name: 'Global Footwear Dist', phone: '9876543210', storeId: STORE_ID, email: 'sales@globalfootwear.com' },
            { name: 'Shoe World Wholesale', phone: '8877665544', storeId: STORE_ID, contactPerson: 'John Smith' },
        ]);
        console.log(`Seed: Added ${suppliers.length} suppliers`);

        // 4. Seed Products
        const productsData = [
            {
                name: 'Neon Blue Runner X1',
                sku: 'SHOE-RN-001',
                barcode: '100000000001',
                category: categories[0]._id,
                brand: brands[0]._id,
                price: 4999,
                costPrice: 2500,
                taxRate: 18,
                images: ['/uploads/products/running_shoe.png'],
                storeId: STORE_ID,
            },
            {
                name: 'Heritage Brown Oxford',
                sku: 'SHOE-FM-001',
                barcode: '100000000002',
                category: categories[1]._id,
                brand: brands[2]._id,
                price: 7999,
                costPrice: 4000,
                taxRate: 18,
                images: ['/uploads/products/formal_shoe.png'],
                storeId: STORE_ID,
            },
            {
                name: 'Minimalist White Sneaker',
                sku: 'SHOE-CS-001',
                barcode: '100000000003',
                category: categories[2]._id,
                brand: brands[1]._id,
                price: 3499,
                costPrice: 1500,
                taxRate: 18,
                images: ['/uploads/products/sneaker.png'],
                storeId: STORE_ID,
            }
        ];

        const products = await Product.insertMany(productsData);
        console.log(`Seed: Added ${products.length} products`);

        // 5. Build Inventory 
        const inventoryItems = products.map(prod => ({
            product: prod._id,
            store: STORE_ID,
            quantity: Math.floor(Math.random() * 50) + 10, // 10-60 items
        }));
        await Inventory.insertMany(inventoryItems);
        console.log(`Seed: Initialized inventory for all products`);

        // 6. Seed Customers
        const customers = await Customer.insertMany([
            { name: 'Aditya Kumar', phone: '9988776655', storeId: STORE_ID, segment: 'VIP', loyaltyPoints: 500 },
            { name: 'Priya Sharma', phone: '8877665544', storeId: STORE_ID, segment: 'Retail' },
            { name: 'Rajesh Gupta', phone: '7766554433', storeId: STORE_ID, segment: 'Wholesale' },
        ]);
        console.log(`Seed: Added ${customers.length} customers`);

        console.log('SEEDING COMPLETED SUCCESSFULLY!');
    } catch (err) {
        console.error('Seed Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seedData();
