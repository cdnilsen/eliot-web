import express from "express"
import path from "path"

import { default as pool } from './db'
import { wrapAsync } from './utils'

import { stringToIntDict, stringToStringDict, stringToIntListDict, stringToStringListDict, intToStringDict, intToIntDict, cleanPunctuation } from './functions'

const app = express()
const port = process.env.PORT;