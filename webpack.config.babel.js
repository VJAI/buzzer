import webpack from 'webpack';
import yargs from 'yargs';
import pkg from './package.json';

const { optimizeMinimize } = yargs.alias('p', 'optimize-minimize').argv;
const nodeEnv = optimizeMinimize ? 'production' : 'development';
const version = pkg.version;

export default {
  mode: 'production',
  entry: { app: './src/Buzz.js' },
  output: {
    path: __dirname + '/dist',
    filename: optimizeMinimize ? `musquito-${version}.min.js` : `musquito-${version}.js`,
    library: '$buzz',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      { test: /\.js$/, exclude: /node_modules/, loader: 'eslint-loader', enforce: 'pre' },
      { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' }
    ]
  },
  plugins: [
    new webpack.BannerPlugin({
      banner:
`/*!
*  musquito v3.0.1
*  http://musquitojs.com
*
*  (c) 2020 Vijaya Anand
*  http://prideparrot.com
*
*  MIT License
*/`,
      raw: true
    })
  ],
  devtool: optimizeMinimize ? 'source-map' : false
};

