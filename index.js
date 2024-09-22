const express = require('express')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const stripe = require("stripe")(process.env.VITE_SECRET_KEY)
const port = process.env.PORT || 5000



// middleware
const corsOptions = {
    origin: ['http://localhost:5173','https://blood-quest.web.app'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

// mongodb connected here....
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1kmrgvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Another collection here....
        const usersCollection = client.db('BloodQuestDB').collection('users')
        const donorCollection = client.db('BloodQuestDB').collection('donor')
        const blogsCollection = client.db('BloodQuestDB').collection('blog')
        const fundsCollection = client.db('BloodQuestDB').collection('fund')


        //======================== jwt related api part start ========================= */
        app.post('/jwt', async (req, res) => {
            const user = req.body;

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' })
            res.
                cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',

                }).
                send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
            } catch (err) {
                res.status(500).send(err)
            }
        })

        const verifyToken = async (req, res, next) => {
            const token = req.cookies?.token
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                else {
                    res.user = decode
                    next()
                }
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const user = req.user
            const query = { email: user?.email }
            const result = await usersCollection.findOne(query)
            if (!result || result?.role !== 'admin') {
                return res.status(401).send({ message: 'unauthorized access!!' })
            }
            next()
        }

        //======================== jwt related api part end =========================== */


        //======================== user related api part start ========================= */
        app.post('/users/api/create', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }

            const isexist = await usersCollection.findOne(query);
            if (isexist) {
                return res.json({
                    message: 'User alredy exist'
                })
            }
            else {
                const result = await usersCollection.insertOne(user)
                res.send(result)
            }
        });


        app.get('/users/related/api/get', async (req, res) => {
            const { status } = req.query;

            let filter = {};
            if (status) {
                filter = { status };
            }
            const result = await usersCollection.find(filter).toArray();
            res.send(result);
        });


        app.get('/user/profile/api/get/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email });
            res.send(result);
        });


        app.put('/userProfile/update/api/:email', async (req, res) => {
            const email = req.params.email;
            const data = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    ...data
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        })


        app.get('/user/role/api/get/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email: email });
            res.send(result);
        });


        //======================== user related api part end =========================== */


        //======================== donor related api part start ========================= */

        app.post('/donor/donation/request/api/create', async (req, res) => {
            const user = req.body;
            const result = await donorCollection.insertOne(user)
            res.send(result)
        });


        app.get('/recent/donation/request/api/get/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { requesterEmail: email }

            const recentData = await donorCollection.find(filter).sort({ donationDate: -1 }).limit(3).toArray();
            res.send(recentData);
        })


        app.get('/allDonor/donation/request/api/get/:email', async (req, res) => {
            const email = req.params.email;
            const filterData = req.query.filterQuery;

            if (email) {
                const filter = { requesterEmail: email }
                const result = await donorCollection.find(filter).toArray();

                if (filterData) {
                    const filterResult = result.filter(data => data.status === filterData);
                    res.send(filterResult)
                }
                else {
                    res.send(result)
                }
            }
        })


        app.get('/donor/donation/request/api/get/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await donorCollection.findOne(query)
            res.send(result)
        })


        app.delete('/donor/donation/request/api/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donorCollection.deleteOne(query)
            res.send(result)
        })


        app.put('/donor/donation/request/api/update/:id', async (req, res) => {
            const id = req.params.id;
            const updateData = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...updateData
                },
            };
            const result = await donorCollection.updateOne(query, updateDoc);
            res.send(result)
        })


        app.get('/search-value/related/api/get', async (req, res) => {
            const { bloodGroup, district, upazila } = req.query;

            let filter = {};
            if (bloodGroup) {
                filter.bloodGroup = bloodGroup;
            }
            if (district) {
                filter.district = district;
            }
            if (upazila) {
                filter.upazila = upazila;
            }

            const result = await donorCollection.find(filter).toArray();
            res.send(result);
        })
        //======================== donor related api part end =========================== */


        //======================== volunteer  related api part start ========================= */

        app.get('/allBlood/donation/request/volunteer/api/get', async (req, res) => {
            const result = await donorCollection.find().toArray();
            res.send(result)
        })


        //======================== volunteer related api part end ============================= */



        //======================== admin  related api part start ========================= */

        app.patch('/user/status/change/api/:email', async (req, res) => {
            const email = req.params.email;
            const status = req.body.status;
            const filter = { email: email }

            let updateStatus = '';
            if (status === 'block') {
                updateStatus = 'blocked'
            }
            else if (status === 'unblock') {
                updateStatus = 'active'
            }

            const updateDoc = {
                $set: {
                    status: updateStatus,
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })


        app.patch('/user/role/change/api/:email', async (req, res) => {
            const email = req.params.email;
            const role = req.body;
            const filter = { email: email }
            const updateDoc = {
                $set: {
                    ...role
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        app.get('/all-donation-request/api/get', async (req, res) => {

            const result = await donorCollection.find().toArray();
            res.send(result);
        })


        app.get('/blood/donation-request/related/api/get/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donorCollection.findOne(query)
            res.send(result)
        })


        app.put('/admin/donation/request/api/update/:id', async (req, res) => {
            const id = req.params.id;
            const updateData = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...updateData
                },
            };
            const result = await donorCollection.updateOne(query, updateDoc);
            res.send(result)
        })


        app.delete('/blood/donation-request/related/api/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donorCollection.deleteOne(query)
            res.send(result)
        })
        //======================== admin related api part end ============================= */



        //======================== blog count related api part start ========================= */

        app.post('/blog/related/api/create', async (req, res) => {
            const blogData = req.body;
            const result = await blogsCollection.insertOne(blogData)
            res.send(result)
        })


        app.get('/allBlog/related/api/get', async (req, res) => {
            const status = req.query.sort

            let filter = {}
            if (status === 'draft') {
                filter.status = status
            }
            else if (status === 'published') {
                filter.status = status
            }

            const result = await blogsCollection.find(filter).toArray();
            res.send(result)
        })

        app.get('/blogData/related/api/get/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await blogsCollection.findOne(query)
            res.send(result)
        })

        app.delete('/blog/releted/api/delete/:id', async (req, res) => {
            const deleteId = req.params.id
            const query = { _id: new ObjectId(deleteId) }
            const result = await blogsCollection.deleteOne(query)
            res.send(result)
        })


        app.put('/blog/related/api/update/:id', async (req, res) => {
            const id = req.params.id;
            const updateData = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...updateData
                },
            };
            const result = await blogsCollection.updateOne(query, updateDoc);
            res.send(result)
        })

        app.patch('/blog/related/api/update/status/:id', async (req, res) => {
            const id = req.params.id;
            const updateData = req.body.status;
            const query = { _id: new ObjectId(id) }

            let updateDoc = {};
            // Check if the status is 'draft'
            if (updateData === 'published') {
                updateDoc = {
                    $set: {
                        status: 'draft',
                    },
                };
            }
            // Check if the status is 'published'
            else if (updateData === 'draft') {
                updateDoc = {
                    $set: {
                        status: 'published'
                    }
                }
            }

            const result = await blogsCollection.updateOne(query, updateDoc)
            res.send(result)
        })
        //======================== blog related api part end ============================= */


        //======================== common api part start ========================= */

        app.patch('/status/change/related/api/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            const filter = { _id: new ObjectId(id) }

            let updateStatus = status;


            const updateDoc = {
                $set: {
                    status: updateStatus,
                },
            };

            const result = await donorCollection.updateOne(filter, updateDoc);
            res.send(result)

        })
        //======================== common api part end ============================= */


        //======================== navbar route api part start ========================= */

        app.get('/navbar/blood/donation/request/pending/api/get', async (req, res) => {
            const result = await donorCollection.find({ status: 'pending' }).toArray();
            res.send(result)
        })


        app.get('/navbar/viewDetails/blood/request/api/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donorCollection.findOne(query)
            res.send(result)
        })

        app.get('/navbar/user/bloodGroup/related/api/:email', async (req, res) => {
            const email = req.params.email;
            const query = { requesterEmail: email }
            const result = await donorCollection.findOne(query)
            res.send(result)
        })


        app.get('/navbar/published/blog/related/api/get', async (req, res) => {
            const result = await blogsCollection.find({ status: 'published' }).toArray();
            res.send(result)
        })


        app.get('/navbar/publishedDetails/related/api/get/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await blogsCollection.findOne(query)
            res.send(result)
        })

        app.put('/navbar/pending/requests/update/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updated_doc = {
                $set: { ...data }
            };
            const result = await donorCollection.updateOne(filter, updated_doc, options);
            res.send(result);
        });
        //======================== navbar route api part end ============================= */


        //======================== donor count related api part start ========================= */

        app.get('/admin/donor/count/related/api/get', async (req, res) => {
            const query = { role: 'donor' };
            const total_user = await usersCollection.countDocuments(query);

            // Sum total funding price
            const fundingResult = await fundsCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        total_funding_price:
                        {
                            $sum:
                                { $toDouble: "$amount" } // total fund_price
                        }
                    }
                }
            ]).toArray();

            const total_funding_price = fundingResult.length > 0 ? fundingResult[0].total_funding_price : 0;

            const total_blood_donation_request = await donorCollection.estimatedDocumentCount();
            res.send({ total_user, total_funding_price, total_blood_donation_request })
        });
        //======================== donor count related api part end =========================== */



        //======================== payment related api part start ========================= */

        app.post('/create-payment-intent', async (req, res) => {
            const price = req.body.amount;
            const priceInCent = parseFloat(price * 100)
            if (!price || priceInCent < 1) return
            // generate client-sectect
            const { client_secret } = await stripe.paymentIntents.create({
                amount: priceInCent,
                currency: "usd",
                // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
                automatic_payment_methods: {
                    enabled: true,
                },
            })
            // send client-secrect response
            res.send({ clientSecret: client_secret })
        })

        app.post('/fund/related/api/create', async (req, res) => {
            const fundData = req.body;
            const result = await fundsCollection.insertOne(fundData)
            res.send(result)
        })


        app.get('/all/fundData/related/api/get', async (req, res) => {
            const result = await fundsCollection.find().toArray();
            res.send(result)
        })
        //======================== payment related api part end =========================== */






        await client.db("admin").command({ ping: 1 });
        console.log("successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('blood quest server')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})