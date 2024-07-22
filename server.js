const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Servir arquivos estáticos da pasta public

mongoose.connect('mongodb://127.0.0.1:27017/restaurant', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const orderSchema = new mongoose.Schema({
  tableNumber: Number,
  orderNumber: String,
  itemPrice: Number,
  status: { type: String, default: 'pending' } // Adiciona o campo status com valor padrão 'pending'
});

const Order = mongoose.model('Order', orderSchema);

// Carregar itens do menu
let menuItems = [];
fs.readFile(path.join(__dirname, 'public', 'menu.json'), 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading menu file:', err);
  } else {
    menuItems = JSON.parse(data);
  }
});

app.post('/order', async (req, res) => {
  const { tableNumber, orderNumber } = req.body;
  const menuItem = menuItems.find(item => item.name === orderNumber);

  if (!menuItem) {
    return res.status(400).send('Invalid order item');
  }

  const newOrder = new Order({ tableNumber, orderNumber, itemPrice: menuItem.price });
  await newOrder.save();
  res.status(201).send('Order received');
});

app.get('/orders', async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

app.get('/orders/:tableNumber', async (req, res) => {
  const { tableNumber } = req.params;
  const orders = await Order.find({ tableNumber: tableNumber });
  res.json(orders);
});

app.put('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await Order.findByIdAndUpdate(id, { status });
  res.status(200).send('Order status updated');
});

app.delete('/orders/reset/:tableNumber', async (req, res) => {
  const { tableNumber } = req.params;
  await Order.deleteMany({ tableNumber: tableNumber });
  res.status(200).send(`Orders for table ${tableNumber} reset`);
});

app.get('/menu', (req, res) => {
  res.json(menuItems);
});

const generateQRCode = async (tableNumber) => {
  try {
    const url = `http://localhost:${PORT}/order.html?table=${tableNumber}`;
    await QRCode.toFile(`./public/qrcodes/table-${tableNumber}.png`, url);
    console.log(`QR code for table ${tableNumber} generated.`);
  } catch (err) {
    console.error(err);
  }
};

// Gerar QR Codes para 10 mesas
for (let i = 1; i <= 5; i++) {
  generateQRCode(i);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
