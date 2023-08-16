/**
 * @swagger
 * tags:
 *   name: Student Records
 *   description: API for managing student records
 * /api/records:
 *   get:
 *     summary: Get all student records
 *     tags: [Student Records]
 *     responses:
 *       200:
 *         description: List of all student records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudentRecord'
 * /api/addstudent:
 *   post:
 *     summary: Create a new student
 *     tags: [Student Records]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *             required:
 *               - name
 *               - email
 *     responses:
 *       201:
 *         description: Student created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentRecord'
 *       400:
 *         description: Bad request - missing or invalid data
 */