const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET);
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// Middleware
app.use(cors());
app.use(express.json());

// Routes
// SET TOKEN .
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorize access' })
    }
    const token = authorization?.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'forbidden user or token has expired' })
        }
        req.decoded = decoded;
        next()
    })
}

// MONGO DB ROUTES



// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rgfriso.mongodb.net/?retryWrites=true&w=majority`;
const uri = "mongodb+srv://udb:JInqsMzpTWw15YmD@cluster0.jcgcmli.mongodb.net/?retryWrites=true&w=majority";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    useNewUrlParser:true,
    useUnifiedTopology:true,
    maxPoolSize:10
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
    //    const appliedCollection = database.collection("applied");
        const userCollection = client.db('U-PR').collection('users')
        const productsCollection = client.db('U-PR').collection('products')
        const cartCollection = client.db('U-PR').collection('cart')
        const orderedCollection = client.db('U-PR').collection('ordered')
        const paymentCollection = client.db('U-PR').collection('payments')
        const appliedCollection = client.db('U-PR').collection('applied')
        
        client.connect((err)=>{
            if(err){
                console.error(err)
                return;
            }
        });

        // Verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user.role === 'admin') {
                next()
            }
            else {
                return res.status(401).send({ error: true, message: 'Unauthorize access' })
            }
        }

        const verifySeller = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user.role === 'seller' || user.role === 'admin') {
                next()
            }
            else {
                return res.status(401).send({ error: true, message: 'Unauthorize access' })
            }
        }


        app.post('/new-user', async (req, res) => {
            const newUser = req.body;

            const result = await userCollection.insertOne(newUser);
            res.send(result);
        })
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_SECRET, { expiresIn: '24h' })
            res.send( {token} )
        })


        // GET ALL USERS
        app.get('/users', async (req, res) => {
            const users = await userCollection.find({}).toArray();
            res.send(users);
        })
        // GET USER BY ID
        app.get('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const user = await userCollection.findOne(query);
            res.send(user);
        })
        // GET USER BY EMAIL
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        })
        // Delete a user

        app.delete('/delete-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })
        // UPDATE USER
        app.put('/update-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedUser = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: updatedUser.name,
                    email: updatedUser.email,
                    role: updatedUser.option,
                    address: updatedUser.address,
                    phone: updatedUser.phone,
                    about: updatedUser.about,
                    photoUrl: updatedUser.photoUrl,
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })


        //  CLASSES ROUTES
        //  PRODUCTS ROUTES

        // /new-class || 
        
        app.post('/new-class', verifyJWT, verifySeller, async (req, res) => {
            // const newClass = req.body;
            // newClass.availableSeats = parseInt(newClass.availableSeats)
            const newProduct = req.body;
            newProduct.availableQuantity = parseInt(newProduct.availableQuantity)
            const result = await productsCollection.insertOne(newProduct);
            res.send(result);
        });

        // GET ALL CLASSES ADDED BY INSTRUCTOR
        // GET ALL PRODUCTS ADDED BY SELLER
        // /classes/:email || const query = { instructorEmail: email };
        
        app.get('/products/:email', verifyJWT, verifySeller, async (req, res) => {
            const email = req.params.email;
            const query = { sellerEmail: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })

        // GET ALL CLASSES
        // GET ALL PRODUCTS
        // '/classes' 
        
        app.get('/products', async (req, res) => {
            const query = { status: 'approved' };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })

        // /classes-manage
        
        app.get('/products-manage', async (req, res) => {
            const result = await productsCollection.find().toArray();
            res.send(result);
        })

        // Change status of a class
        // change status of a product
        
        app.put('/change-status/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            console.log(req.body)
            const reason = req.body.reason;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    status: status,
                    reason: reason
                }
            }
            const result = await productsCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        // * GET APPROVED CLASSES
        // GET APPROVED PRODUCTS
        // '/approved-classes' || 
        
        app.get('/approved-products', async (req, res) => {
            const query = { status: 'approved' };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })

        // GET ALL INSTRUCTORS
        // GET ALL  SELLERS 
        // '/instructors' || const query = { role: 'instructor' };
        
        app.get('/sellers', async (req, res) => {
            const query = { role: 'seller' };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        })

        // Update a class
        // Update a product
        // '/update-class/:id' || 
            // const updatedClass = req.body;
            // const updateDoc = {
            //     $set: {
            //         name: updatedClass.name,
            //         description: updatedClass.description,
            //         price: updatedClass.price,
            //         availableSeats: parseInt(updatedClass.availableSeats),
            //         videoLink: updatedClass.videoLink,
            //         status: 'pending'
            //     }
            // }


        app.put('/update-product/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const updateProduct = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: updateProduct.name,
                    description: updateProduct.description,
                    price: updateProduct.price,
                    availableQuantity: parseInt(updateProduct.availableQuantity),
                    status: 'pending'
                }
            }
            const result = await productsCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })


        // Get single class by id for details page
        // Get single product by id for details page
        // '/class/:id' || 
        
        app.get('/prduct/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productsCollection.findOne(query);
            res.send(result);
        })
        // ! CART ROUTES

        // ADD TO CART
    
        app.post('/add-to-cart', verifyJWT, async (req, res) => {
            const newCartItem = req.body;
            const result = await cartCollection.insertOne(newCartItem);
            res.send(result);
        })
        // Get cart item id for checking if a class is already in cart
        // Get cart item id for checking if a product is already in cart
        // const query = { classId: id, userMail: email }; || const projection = { classId: 1 };
        
        app.get('/cart-item/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const email = req.query.email;
            const query = { productId: id, userMail: email };
            const projection = { productId: 1 };
            const result = await cartCollection.findOne(query, { projection: projection });
            res.send(result);
        })

        // const projection = { classId: 1 };
        // const carts = await cartCollection.find(query, { projection: projection }).toArray();
        // const classIds = carts.map(cart => new ObjectId(cart.classId));
        // const query2 = { _id: { $in: classIds } };
        // const result = await classesCollection.find(query2).toArray();

        app.get('/cart/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { userMail: email };
            const projection = { productId: 1 };
            const carts = await cartCollection.find(query, { projection: projection }).toArray();
            const productIds = carts.map(cart => new ObjectId(cart.productId));
            const query2 = { _id: { $in: productIds } };
            const result = await productsCollection.find(query2).toArray();
            res.send(result);
        })


        app.get("/my-cart", verifyJWT, async (req, res) => {
            const myEmail = req.query.email;
            if (!myEmail) {
              return res
                .status(403)
                .send({ error: "no info of the customer found!" });
            }
            if (req.decoded.email !== myEmail) {
              return res.status(403).send({ error: "Unauthorized access!" });
            }
            const queryFilter = { email: myEmail };
            // const myCart = await cartCollection.find({purchasedBy:myEmail}).toArray();
            const myCart = await cartCollection
              .aggregate([
                { $match: queryFilter },
                {
                  $facet: {
                    documents: [{ $match: queryFilter }], // Example: find the first 10 documents
                    totalCount: [{ $count: "count" }],
                  },
                },
              ])
              .toArray();
            res.send(myCart);
          });

        // Delete a item form cart
        // const query = { classId: id };
        
        app.delete('/delete-cart-item/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { productId: id };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // PAYMENT ROUTES
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        })
        // POST PAYMENT INFO [PPP] [AAA]
        // classesId => productsId || singleClassId => singleProductId || classId => productId
        // classes => products || classesQuery => productsQuery
        // classesCollection => productsCollection
        // totalEnrolled => totalSell || availableSeats => availableQuantity
        // enrolledResult => orderedResult || newEnrolledData => newOrderedData
        // enrolledCollection =>orderedCollection || approvedClasses => approvedProducts
        // pendingClasses => pendingProducts || totalClasses => totalProducts
        
        app.post('/payment-info', verifyJWT, async (req, res) => {
            const paymentInfo = req.body;
            const productsId = paymentInfo.productsId;
            const userEmail = paymentInfo.userEmail;
            const singleProductId = req.query.productId;
            let query;
            // const query = { classId: { $in: classesId } };
            if (singleProductId) {
                query = { productId: singleProductId, userMail: userEmail };
            } else {
                query = { productId: { $in: productsId } };
            }
            const productsQuery = { _id: { $in: productsId.map(id => new ObjectId(id)) } }
            const products = await productsCollection.find(productsQuery).toArray();
            const newOrderedData = {
                userEmail: userEmail,
                productsId: productsId.map(id => new ObjectId(id)),
                transactionId: paymentInfo.transactionId,
            }
            const updatedDoc = {
                $set: {
                    totalSell: products.reduce((total, current) => total + current.totalSell, 0) + 1 || 0,
                    availableQuantity: products.reduce((total, current) => total + current.availableQuantity, 0) - 1 || 0,
                }
            }
            // const updatedInstructor = await userCollection.find()
            const updatedResult = await productsCollection.updateMany(productsQuery, updatedDoc, { upsert: true });
            const orderedResult = await orderedCollection.insertOne(newOrderedData);
            const deletedResult = await cartCollection.deleteMany(query);
            const paymentResult = await paymentCollection.insertOne(paymentInfo);
            res.send({ paymentResult, deletedResult, orderedResult, updatedResult });
        })


        app.get('/payment-history/:email', async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
            res.send(result);
        })


        app.get('/payment-history-length/:email', async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const total = await paymentCollection.countDocuments(query);
            res.send({ total });
        })


        // ! ENROLLED ROUTES
        // ORDERED ROUTES
        // '/popular_classes'

        app.get('/popular_products', async (req, res) => {
            const result = await productsCollection.find().sort({ totalSell: -1 }).limit(6).toArray();
            res.send(result);
        })

        // '/popular-instructors'

        app.get('/popular-sellers', async (req, res) => {
            const pipeline = [
                {
                    $group: {
                        _id: "$sellerEmail",
                        totalSell: { $sum: "$totalSell" },
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "email",
                        as: "seller"
                    }
                },
                {
                    $project: {
                        _id: 0,
                        seller: {
                            $arrayElemAt: ["$seller", 0]
                        },
                        totalSell: 1
                    }
                },
                {
                    $sort: {
                        totalSell: -1
                    }
                },
                {
                    $limit: 6
                }
            ]
            const result = await productsCollection.aggregate(pipeline).toArray();
            res.send(result);

        })

        // const approvedClasses = (await classesCollection.find({ status: 'approved' }).toArray()).length;
        // const pendingClasses = (await classesCollection.find({ status: 'pending' }).toArray()).length;
        // const instructors = (await userCollection.find({ role: 'instructor' }).toArray()).length;
        // const totalClasses = (await classesCollection.find().toArray()).length;
        // const totalSell = (await enrolledCollection.find().toArray()).length;
        
        // Admins stats 
        app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
            // Get approved classes and pending classes and instructors 
            const approvedProducts = (await productsCollection.find({ status: 'approved' }).toArray()).length;
            const pendingProducts = (await productsCollection.find({ status: 'pending' }).toArray()).length;
            const sellers = (await userCollection.find({ role: 'seller' }).toArray()).length;
            const totalProducts = (await productsCollection.find().toArray()).length;
            const totalSell = (await orderedCollection.find().toArray()).length;
            // const totalRevenue = await paymentCollection.find().toArray();
            // const totalRevenueAmount = totalRevenue.reduce((total, current) => total + parseInt(current.price), 0);
            const result = {
                approvedProducts,
                pendingProducts,
                sellers,
                totalProducts,
                totalSell,
                // totalRevenueAmount
            }
            res.send(result);

        })

        // !GET ALL INSTrUCTOR  
        // !GET ALL SELLER  
        // '/instructors'

        // app.get('/sellers', async (req, res) => {
        //     const result = await userCollection.find({ role: 'seller' }).toArray();
        //     res.send(result);
        // })


        // '/enrolled-classes/:email'
        // $lookup: {
        //     from: "classes",
        //     localField: "classesId",
        //     foreignField: "_id",
        //     as: "classes"
        // }

        app.get('/ordered-products/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const pipeline = [
                {
                    $match: query
                },
                {
                    $lookup: {
                        from: "products",
                        localField: "productsId",
                        foreignField: "_id",
                        as: "products"
                    }
                },
                {
                    $unwind: "$products"
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "products.sellerEmail",
                        foreignField: "email",
                        as: "seller"
                    }
                },
                {
                    $project: {
                        _id: 0,
                        products: 1,
                        seller: {
                            $arrayElemAt: ["$seller", 0]
                        }
                    }
                }

            ]
            const result = await orderedCollection.aggregate(pipeline).toArray();
            // const result = await orderedCollection.find(query).toArray();
            res.send(result);
        })

        // Applied route 
        // '/as-instructor',
        
        app.post('/as-seller', async (req, res) => {
            const data = req.body;
            const result = await appliedCollection.insertOne(data);
            res.send(result);
        })
        // '/applied-instructors/:email'
        app.get('/applied-seller/:email',   async (req, res) => {
            const email = req.params.email;
            const result = await appliedCollection.findOne({email});
            res.send(result);
        });
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('E Commerce is Running');
})


// Listen
app.listen(port, () => {
    console.log(`SERVER IS RUNNING ON PORT ${port}`);
})