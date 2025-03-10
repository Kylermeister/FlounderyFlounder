const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const NodeCache = require('node-cache');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

const app = express();

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: "IPAAN Backend API",
      version: '1.0.0',
    },
  },
  apis: ["server9.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'postgres',
  password: 'kyler',
  port: 5433,
});

const myCache = new NodeCache();

app.use(bodyParser.json());
app.use(cors());

const validateSelectQuery = (req, res, next) => {
  const { sql } = req.body;
  console.log(`A request has been received`);

  if (!sql) {
    return res.status(400).send('SQL query is required');
  }

  const trimmedSql = sql.trim().toUpperCase();

  
  const forbiddenClauses = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'TRUNCATE', 'EXECUTE'];
  const hasForbiddenClauses = forbiddenClauses.some(clause => trimmedSql.includes(clause));
  if (hasForbiddenClauses) {
    return res.status(400).send('Forbidden SQL operation detected');
  }

  next();
};

/**
 * @swagger
 * /query/line:
 *   post:
 *     tags:
 *       - Example
 *     summary: submit line graph request
 *     description: Returns the average upload and download speed as well as latency and lossrate of the specified filters for each day in the duration. The 3 filters can each be empty, but elements must be seperated by a comma. Dates must be included and sent using the format "YYYY-MM-DD".
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             filters:
 *               type: object
 *               properties:
 *                 countries:
 *                   type: array
 *                   example: ["ZA"]
 *                 cities:
 *                   type: array
 *                   example: ["Cape Town","Durban","Pretoria","Bloemfontein"]
 *                 isps:
 *                   type: array
 *                   example: ["Vodacom","Telkom SA Ltd.","MTN SA","Afrihost (Pty) Ltd"]
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-01-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-03-31"
 *     responses:
 *       200:
 *         description: The first item in the response to the example should be the following.
 *         schema:
 *           type: object
 *           properties:
 *             date:
 *               type: string
 *               format: date
 *               example: "2024-01-01"
 *             city:
 *               type: string
 *               example: "Bloemfontein"
 *             countrycode:
 *               type: string
 *               example: "ZA"
 *             isp:
 *               type: string
 *               example: "Afrihost (Pty) Ltd"
 *             download:
 *               type: string
 *               example: "40.52"
 *             upload:
 *               type: string
 *               example: "37.57"
 *             lossrate:
 *               type: string
 *               example: "0.86"
 */
app.post('/query/line', async (req, res) => {
  const { filters, startDate, endDate } = req.body;
  if (!filters || (!filters.cities && !filters.countries && !filters.isps)) {
    return res.status(400).send('At least one filter is required');
  }

  const sql = buildLineQuery(filters, startDate, endDate);
  req.body.sql = sql;
  validateSelectQuery(req, res, () => executeQuery(sql, res));
});

/**
 * @swagger
 * /query/bar:
 *   post:
 *     tags:
 *       - Example
 *     summary: submit bar graph request
 *     description: Returns the average upload and download speed as well as latency and lossrate of the specified filters for each day in the duration. The 3 filters can each be empty, but elements must be seperated by a comma. Dates must be included and sent using the format "YYYY-MM-DD".
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             filters:
 *               type: object
 *               properties:
 *                 countries:
 *                   type: array
 *                   example: ["ZA"]
 *                 cities:
 *                   type: array
 *                   example: ["Cape Town","Durban","Pretoria","Bloemfontein"]
 *                 isps:
 *                   type: array
 *                   example: ["Vodacom","Telkom SA Ltd.","MTN SA","Afrihost (Pty) Ltd"]
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-01-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-03-31"
 *     responses:
 *       200:
 *         description: The first item in the response to the example should be the following.
 *         schema:
 *           type: object
 *           properties:
 *            city:
 *               type: string
 *               example: "Bloemfontein"
 *            countrycode:
 *               type: string
 *               example: "ZA"
 *            isp:
 *               type: string
 *               example: "Afrihost (Pty) Ltd"
 *            download:
 *               type: string
 *               example: "62.00"
 *            upload:
 *               type: string
 *               example: "47.46"
 */
app.post('/query/bar', async (req, res) => {
  const { filters, startDate, endDate } = req.body;
  if (!filters || (!filters.cities && !filters.countries && !filters.isps)) {
    return res.status(400).send('At least one filter is required');
  }

  const sql = buildBarQuery(filters, startDate, endDate);
  req.body.sql = sql;
  validateSelectQuery(req, res, () => executeQuery(sql, res));
});

/**
 * @swagger
 * /query/pie:
 *   post:
 *     tags:
 *       - Example
 *     summary: submit pie graph request
 *     description: Finds the number of tests performed across all selected cities in the date range of format "YYYY-MM-DD", then returns how many each city has, as well as how much percentage of the group total they are.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             filters:
 *               type: object
 *               properties:
 *                 countries:
 *                   type: array
 *                   example: []
 *                 cities:
 *                   type: array
 *                   example: ["Cape Town","Durban","Pretoria","Bloemfontein"]
 *                 isps:
 *                   type: array
 *                   example: []
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-01-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-03-31"
 *     responses:
 *       200:
 *         description: The first item in the response to the example should be the following.
 *         schema:
 *           type: object
 *           properties:
 *             city:
 *               type: string
 *               example: "Cape Town"
 *             group_count:
 *               type: string
 *               example: "979117"
 *             percentage_of_total:
 *               type: string
 *               example: "49.86"
 */
app.post('/query/pie', async (req, res) => {
  const { filters, startDate, endDate } = req.body;
  if (!filters || (!filters.cities && !filters.countries && !filters.isps)) {
    return res.status(400).send('At least one filter is required');
  }

  const sql = buildPieQuery(filters, startDate, endDate);
  req.body.sql = sql;
  validateSelectQuery(req, res, () => executeQuery(sql, res));
});

/**
 * @swagger
 * /query/map:
 *   post:
 *     tags:
 *       - Example
 *     summary: submit map request
 *     description: Returns the selection of map points across all the filters in the date field in the format "YYYY-MM-DD" as well as their respective download speeds.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             filters:
 *               type: object
 *               properties:
 *                 countries:
 *                   type: array
 *                   example: ["ZA"]
 *                 cities:
 *                   type: array
 *                   example: ["Cape Town","Durban","Pretoria","Bloemfontein"]
 *                 isps:
 *                   type: array
 *                   example: ["Vodacom","Telkom SA Ltd.","MTN SA","Afrihost (Pty) Ltd"]
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-01-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-03-31"
 *     responses:
 *       200:
 *         description: The first item in the response to the example should be the following.
 *         schema:
 *           type: number
 *           example: [-29.1252,26.163,21.1]
 */
app.post('/query/map', async (req, res) => {
  const { filters, startDate, endDate } = req.body;
  if (!filters || (!filters.cities && !filters.countries && !filters.isps)) {
    return res.status(400).send('At least one filter is required');
  }

  const sql = buildMapQuery(filters, startDate, endDate);
  req.body.sql = sql;
  validateSelectQuery(req, res, () => executeMapQuery(sql, res));
});

const buildLineQuery = (filters, startDate, endDate) => {
  const { cities, countries, isps } = filters;

  let selectFields = [
    "TO_CHAR(DATE_TRUNC('day', x.date), 'YYYY-MM-DD') AS date",
    "AVG(x.meanthroughputmbps) AS Speed",
    "avg(x.minrtt) AS Latency"
  ];
  let groupByFields = ["date"];
  let orderByFields = ["date"];

  if (cities && cities.length > 0) {
    selectFields.push("y.city");
    groupByFields.push("y.city");
    orderByFields.push("y.city");
  }

  if (countries && countries.length > 0) {
    selectFields.push("y.countrycode");
    groupByFields.push("y.countrycode");
    orderByFields.push("y.countrycode");
  }

  if (isps && isps.length > 0) {
    selectFields.push("y.isp");
    groupByFields.push("y.isp");
    orderByFields.push("y.isp");
  }

  // Construct GROUP BY clause dynamically
  const groupByClause = groupByFields.join(", ");

  // Main query for download data
  let query = `
    WITH download_data AS (
      SELECT
        ${selectFields.join(", ")},
        (avg(x.lossrate) * 100) as Lossrate
      FROM download x
      JOIN descriptors y ON x.descriptorid = y.id
      WHERE 1=1
  `;

  if (cities && cities.length > 0) {
    const cityList = cities.map(city => `'${city}'`).join(',');
    query += ` AND y.city IN (${cityList})`;
  }

  if (countries && countries.length > 0) {
    const countryList = countries.map(country => `'${country}'`).join(',');
    query += ` AND y.countrycode IN (${countryList})`;
  }

  if (isps && isps.length > 0) {
    const ispList = isps.map(isp => `'${isp}'`).join(',');
    query += ` AND y.isp IN (${ispList})`;
  }

  if (startDate && endDate) {
    query += ` AND x.date BETWEEN '${startDate}' AND '${endDate}'`;
  }

  query += `
      GROUP BY ${groupByClause}
    ),

    upload_data AS (
      SELECT
      ${selectFields.join(", ")}
      FROM upload x
      JOIN descriptors y ON x.descriptorid = y.id
      WHERE 1=1
  `;

  if (cities && cities.length > 0) {
    const cityList = cities.map(city => `'${city}'`).join(',');
    query += ` AND y.city IN (${cityList})`;
  }

  if (countries && countries.length > 0) {
    const countryList = countries.map(country => `'${country}'`).join(',');
    query += ` AND y.countrycode IN (${countryList})`;
  }

  if (isps && isps.length > 0) {
    const ispList = isps.map(isp => `'${isp}'`).join(',');
    query += ` AND y.isp IN (${ispList})`;
  }

  if (startDate && endDate) {
    query += ` AND x.date BETWEEN '${startDate}' AND '${endDate}'`;
  }

  query += `
      GROUP BY ${groupByClause}
    )

    SELECT
      y.date,
      `

      if (cities && cities.length > 0) {
        query += ` y.city,
        `;
      }
    
      if (countries && countries.length > 0) {
        query += ` y.countrycode,
        `;
      }
    
      if (isps && isps.length > 0) {
        query += ` y.isp,
        `;
      }

      query +=`ROUND(y.Speed::numeric,2) as Download,
      ROUND(u.speed::numeric,2) AS Upload,
      ROUND(y.Lossrate::numeric,2) as Lossrate
    FROM download_data y
    LEFT JOIN upload_data u ON y.date = u.date `

    if (cities && cities.length > 0) {
      query += `AND y.city = u.city
      `;
    }
  
    if (countries && countries.length > 0) {
      query += ` And y.countrycode = u.countrycode
      `;
    }
  
    if (isps && isps.length > 0) {
      query += ` AND y.isp = u.isp 
      `;
    }

    query += `ORDER BY ${orderByFields.join(", ")};
  `;

  return query;
};

const buildBarQuery = (filters, startDate, endDate) => {
  const { cities, countries, isps } = filters;
  let selectFields = ["AVG(d.meanthroughputmbps) AS download"];
  let groupByFields = [];
  let joinConditions = [];
  let whereConditions = ["1=1"];
  
  if (cities && cities.length > 0) {
    selectFields.push("y.city");
    groupByFields.push("y.city");
    joinConditions.push("y.city");
    const cityList = cities.map(city => `'${city}'`).join(',');
    whereConditions.push(`y.city IN (${cityList})`);
  }
  
  if (countries && countries.length > 0) {
    selectFields.push("y.countrycode");
    groupByFields.push("y.countrycode");
    joinConditions.push("y.countrycode");
    const countryList = countries.map(country => `'${country}'`).join(',');
    whereConditions.push(`y.countrycode IN (${countryList})`);
  }
  
  if (isps && isps.length > 0) {
    selectFields.push("y.isp");
    groupByFields.push("y.isp");
    joinConditions.push("y.isp");
    const ispList = isps.map(isp => `'${isp}'`).join(',');
    whereConditions.push(`y.isp IN (${ispList})`);
  }
  
  if (startDate && endDate) {
    whereConditions.push(`d.date BETWEEN '${startDate}' AND '${endDate}'`);
  }
  
  const groupByClause = groupByFields.join(", ");
  const joinClause = joinConditions.length > 0 ? joinConditions.join(" AND ") : "1=1";

  let query = `
    WITH download_data AS (
      SELECT ${selectFields.join(", ")}
      FROM download d
      JOIN descriptors y ON d.descriptorid = y.id
      WHERE ${whereConditions.join(" AND ")}
      GROUP BY ${groupByClause}
    ),
    upload_data AS (
      SELECT AVG(u.meanthroughputmbps) AS upload, ${groupByFields.join(", ")}
      FROM upload u
      JOIN descriptors y ON u.descriptorid = y.id
      WHERE ${whereConditions.join(" AND ").replace(/d.date/g, 'u.date')}
      GROUP BY ${groupByClause}
    )
    SELECT
      ${groupByFields.join(",").replace(/y.city/g, 'd.city')},
      ROUND(d.download::numeric,2) AS download,
      ROUND(y.upload::numeric,2) AS upload
    FROM download_data d
    LEFT JOIN upload_data y ON 1=1 `

    if (cities && cities.length > 0) {
      query += `AND y.city = d.city
      `;
    }
  
    if (countries && countries.length > 0) {
      query += ` And y.countrycode = d.countrycode
      `;
    }
  
    if (isps && isps.length > 0) {
      query += ` AND y.isp = d.isp 
      `;
    }

    query +=  ` ORDER BY ${groupByFields.join(", ")};
  ;`
  
  return query;
};

const buildPieQuery = (filters, startDate, endDate) => {
  const { cities, countries, isps } = filters;

  const cityList = cities.map(city => `'${city}'`).join(',');

  let query = `select y.city,
  COUNT(*) AS group_count,
  ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()), 2) AS percentage_of_total
FROM
  download x 
join descriptors y on x.descriptorid = y.id 
where y.city IN (${cityList})
AND x.date BETWEEN '${startDate}' AND '${endDate}'
GROUP BY
  y.city 
ORDER BY
  percentage_of_total DESC;`

  return query
};

const buildMapQuery = (filters, startDate, endDate) => {
  const { cities, countries, isps } = filters;

  let query = `SELECT json_build_array(
  ST_Y(ST_Transform(x.geom, 4326)),
  ST_X(ST_Transform(x.geom, 4326)),
  x.meanthroughputmbps)::text AS formatted_result
FROM
  download x
  JOIN descriptors y ON x.descriptorid = y.id
where 1=1`
if (cities && cities.length > 0) {
  const cityList = cities.map(city => `'${city}'`).join(',');
  query += ` AND y.city IN (${cityList})`;
  
}

if (countries && countries.length > 0) {
  const countryList = countries.map(country => `'${country}'`).join(',');
  query += ` AND y.countrycode IN (${countryList})`;
}

if (isps && isps.length > 0) {
  const ispList = isps.map(isp => `'${isp}'`).join(',');
  query += ` AND y.isp IN (${ispList})`;
}

query += ` AND x.date BETWEEN '${startDate}' AND '${endDate}'
 limit (10000)`

  return query;
};

const executeQuery = async (sql, res) => {
  const cacheKey = `query_${Buffer.from(sql).toString('base64')}`;
  const cachedData = myCache.get(cacheKey);

  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  try {
    //console.log(sql)
    const result = await pool.query(sql);
    myCache.set(cacheKey, result.rows, 3600);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }
};

const executeMapQuery = async (sql, res) => {
  const cacheKey = `query_${Buffer.from(sql).toString('base64')}`;
  const cachedData = myCache.get(cacheKey);

  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  try {
    //console.log(sql)
    const result = await pool.query(sql);
    const transformedResults = result.rows.map(row => JSON.parse(row.formatted_result));
    myCache.set(cacheKey, transformedResults, 3600);
    res.status(200).json(transformedResults);

  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
