const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const admin = require('../controllers/adminController');

// Restaurant admin dashboard API (admin-dashboard/). Every route needs a staff login (JWT).
// Role rules match admin-dashboard/src/lib/permissions.ts and are enforced here, not only in the UI:
//   staff (dashboard "employee"): orders, kitchen, menu/tables read-only
//   manager: + cancel orders, edit menu/categories/tables, view payments
//   admin: + staff accounts
const STAFF = ['admin', 'manager', 'staff'];
const MANAGERS = ['admin', 'manager'];
const ADMINS = ['admin'];

const router = express.Router();
router.use(protect);
const allow = (roles) => authorize(...roles);

router.get('/dashboard/stats', allow(STAFF), admin.dashboardStats);

router.get('/orders', allow(STAFF), admin.listOrders);
router.get('/orders/:id', allow(STAFF), admin.getOrder);
router.patch('/orders/:id/status', allow(STAFF), admin.updateOrderStatus); // cancelling is checked for managers inside
router.patch('/orders/:id/payment', allow(STAFF), admin.markOrderPaid);

router.get('/menu/items', allow(STAFF), admin.listMenuItems);
router.post('/menu/items', allow(MANAGERS), admin.createMenuItem);
router.put('/menu/items/:id', allow(MANAGERS), admin.updateMenuItem);
router.patch('/menu/items/:id/availability', allow(MANAGERS), admin.setMenuAvailability);
router.delete('/menu/items/:id', allow(MANAGERS), admin.deleteMenuItem);

router.get('/menu/categories', allow(STAFF), admin.listCategories);
router.post('/menu/categories', allow(MANAGERS), admin.saveCategory);
router.put('/menu/categories/:id', allow(MANAGERS), admin.saveCategory);
router.delete('/menu/categories/:id', allow(MANAGERS), admin.deleteCategory);

router.get('/tables', allow(STAFF), admin.listTables);
router.post('/tables', allow(MANAGERS), admin.saveTable);
router.put('/tables/:id', allow(MANAGERS), admin.saveTable);
router.patch('/tables/:id/status', allow(MANAGERS), admin.setTableStatus);
router.delete('/tables/:id', allow(MANAGERS), admin.deleteTable);

router.get('/payments', allow(MANAGERS), admin.listPayments);

router.get('/staff', allow(ADMINS), admin.listStaff);
router.post('/staff', allow(ADMINS), admin.saveStaff);
router.put('/staff/:id', allow(ADMINS), admin.saveStaff);
router.delete('/staff/:id', allow(ADMINS), admin.deleteStaff);

module.exports = router;
