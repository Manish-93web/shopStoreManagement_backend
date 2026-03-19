import mongoose from 'mongoose';
import dotenv from 'dotenv';
// Load models
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Inventory from '../models/Inventory.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
dotenv.config();
const STORE_ID = '67d9492c9bc301ba3373111f';
const OWNER_ID = '67d94cf4b32b492c9bc301ba';
async function seedData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Seed: Connected to MongoDB');
        // Clean up existing data for this store 
        await Promise.all([
            Category.deleteMany({ storeId: STORE_ID }),
            Brand.deleteMany({ storeId: STORE_ID }),
            Product.deleteMany({ storeId: STORE_ID }),
            Customer.deleteMany({ storeId: STORE_ID }),
            Supplier.deleteMany({ storeId: STORE_ID }),
            Inventory.deleteMany({ store: STORE_ID }),
            Order.deleteMany({ storeId: STORE_ID }),
            Employee.deleteMany({ storeId: STORE_ID }),
        ]);
        console.log('Seed: Cleaned existing store data');
        // 1. Seed Categories
        const categories = await Category.insertMany([
            { name: 'Running Shoes', storeId: STORE_ID, description: 'High-performance athletic gear for professional runners and enthusiasts.' },
            { name: 'Formal Shoes', storeId: STORE_ID, description: 'Premium leather collection for grand occasions and corporate elegance.' },
            { name: 'Casual Sneakers', storeId: STORE_ID, description: 'Modern, minimalist designs for everyday urban comfort.' },
            { name: 'Outdoor Boots', storeId: STORE_ID, description: 'Rugged, water-resistant footwear for adventure and durability.' },
            { name: 'Luxury Sandals', storeId: STORE_ID, description: 'Handcrafted comfort for premium summer styling.' },
        ]);
        // 2. Seed Brands
        const brands = await Brand.insertMany([
            { name: 'SportSync Pro', storeId: STORE_ID, description: 'Elite athletic innovation.' },
            { name: 'UrbanStep Elite', storeId: STORE_ID, description: 'Contemporary urban aesthetics.' },
            { name: 'ClassicTread', storeId: STORE_ID, description: 'Timeless craftsmanship.' },
            { name: 'EcoStride', storeId: STORE_ID, description: 'Sustainable luxury.' },
        ]);
        // 3. Seed Suppliers
        const suppliers = await Supplier.insertMany([
            { name: 'Global Footwear Dist', phone: '9876543210', storeId: STORE_ID, email: 'sales@globalfootwear.com', address: 'Market St, NY' },
            { name: 'Premium Leather Wholesale', phone: '8877665544', storeId: STORE_ID, contactPerson: 'John Smith', address: 'Leather District, IT' },
        ]);
        // 4. Seed Products
        const productsData = [
            { name: 'Cobalt Aero Runner', sku: 'SHOE-RN-101', barcode: '200000000001', category: categories[0]._id, brand: brands[0]._id, price: 5499, costPrice: 2800, taxRate: 18, images: ['/uploads/products/running_shoe.png'], storeId: STORE_ID },
            { name: 'Mahogany Oxford Elite', sku: 'SHOE-FM-201', barcode: '200000000002', category: categories[1]._id, brand: brands[2]._id, price: 8999, costPrice: 4500, taxRate: 18, images: ['/uploads/products/formal_shoe.png'], storeId: STORE_ID },
            { name: 'Minimalist Frost White', sku: 'SHOE-CS-301', barcode: '200000000003', category: categories[2]._id, brand: brands[1]._id, price: 3999, costPrice: 1800, taxRate: 12, images: ['/uploads/products/sneaker.png'], storeId: STORE_ID },
            { name: 'IronClad Trail Boot', sku: 'SHOE-BT-401', barcode: '200000000004', category: categories[3]._id, brand: brands[3]._id, price: 6999, costPrice: 3500, taxRate: 18, images: ['/uploads/products/running_shoe.png'], storeId: STORE_ID },
            { name: 'Velvet Slip-ons', sku: 'SHOE-CS-302', barcode: '200000000005', category: categories[2]._id, brand: brands[1]._id, price: 2999, costPrice: 1200, taxRate: 12, images: ['/uploads/products/sneaker.png'], storeId: STORE_ID },
            { name: 'Midnight Racer G2', sku: 'SHOE-RN-102', barcode: '200000000006', category: categories[0]._id, brand: brands[0]._id, price: 7499, costPrice: 3800, taxRate: 18, images: ['/uploads/products/running_shoe.png'], storeId: STORE_ID },
        ];
        const products = await Product.insertMany(productsData);
        // 5. Build Inventory 
        const inventoryItems = products.map(prod => ({
            product: prod._id,
            store: STORE_ID,
            quantity: Math.floor(Math.random() * 80) + 20,
        }));
        await Inventory.insertMany(inventoryItems);
        // 6. Seed Customers
        const customers = await Customer.insertMany([
            { name: 'Aditya Vardhan', phone: '9988776655', storeId: STORE_ID, segment: 'VIP', loyaltyPoints: 1200 },
            { name: 'Anjali Sharma', phone: '8877665544', storeId: STORE_ID, segment: 'Retail', loyaltyPoints: 150 },
            { name: 'Vikram Seth', phone: '7766554433', storeId: STORE_ID, segment: 'Wholesale' },
        ]);
        // 7. Seed Employees
        const staffEmail = 'anil.cashier@testshop.com';
        let staffUser = await User.findOne({ email: staffEmail });
        if (!staffUser) {
            staffUser = await User.create({
                name: 'Anil Cashier',
                email: staffEmail,
                password: 'password123', // Will be hashed by pre-save
                role: 'CASHIER',
                storeId: STORE_ID,
                isActive: true
            });
        }
        await Employee.create({
            user: staffUser._id,
            employeeId: 'EMP-SHOE-001',
            storeId: STORE_ID,
            designation: 'Senior Sales Executive',
            salary: { base: 28000, currency: 'INR', frequency: 'Monthly' },
            status: 'Active'
        });
        // 8. Seed Orders
        const orders = [];
        const now = new Date();
        for (let i = 0; i < 50; i++) {
            const date = new Date();
            date.setDate(now.getDate() - Math.floor(Math.random() * 30));
            const randomProd = products[Math.floor(Math.random() * products.length)];
            const qty = Math.floor(Math.random() * 2) + 1;
            const subTotal = randomProd.price * qty;
            const taxTotal = subTotal * (randomProd.taxRate / 100);
            const grandTotal = subTotal + taxTotal;
            orders.push({
                orderNumber: `SALE-SHOE-${Date.now()}-${i}`,
                storeId: STORE_ID,
                customer: customers[Math.floor(Math.random() * customers.length)]._id,
                items: [{
                        product: randomProd._id,
                        name: randomProd.name,
                        quantity: qty,
                        price: randomProd.price,
                        tax: taxTotal,
                        discount: 0,
                        total: grandTotal
                    }],
                subTotal, taxTotal, discountTotal: 0, grandTotal,
                paymentDetails: [{ method: 'UPI', amount: grandTotal }],
                status: 'Completed',
                paymentStatus: 'Paid',
                cashier: OWNER_ID,
                createdAt: date,
                updatedAt: date
            });
        }
        await Order.insertMany(orders);
        console.log('--- SEEDING SUCCESSFUL ---');
        console.log(`Categories: ${categories.length}`);
        console.log(`Products: ${products.length}`);
        console.log(`Orders: ${orders.length}`);
    }
    catch (err) {
        console.error('Seed Error:', err);
    }
    finally {
        await mongoose.disconnect();
    }
}
seedData();
