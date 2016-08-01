"use strict";

var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var getPostcssStack = require('gitter-styleguide/postcss-stack');

var config = {
  entry: {
    index: path.resolve(__dirname, './browser/js/index'),
  },
  output: {
    path: path.resolve(__dirname, "./output/assets/js/"),
    filename: "[name].js",
    chunkFilename: "[id].chunk.js",
    publicPath: "/_s/l/js/forums/",
    devtoolModuleFilenameTemplate: "[resource-path]",
    devtoolFallbackModuleFilenameTemplate: "[resource-path]?[hash]"
  },
  module: {
    loaders: [
      {
        test:    /.css$/,
        loader:  'style-loader!css-loader!postcss-loader',
      },
      //{
      //  test: /.less$/,
      //  loader: ExtractTextPlugin.extract('style-loader', 'css-loader!less-loader'),
      //  include: path.resolve(__dirname, './browser/less')
      //},
      {
        test: /\.jsx$/,
        loader: 'babel',
        query: {
          presets: [
            "es2015",
            "react"
          ]
        }
      }
    ]
  },
  resolve: {
    alias: {
      jquery: path.resolve(__dirname, './node_modules/jquery/dist/jquery.js'),
    }
  },
  plugins: [
    //new ExtractTextPlugin("style.css", { allChunks: false })
  ],
  externals: {
    'cheerio': 'window',
    'react/addons': true,
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
    fs: '{}',
  },
  postcss: function(webpack) {
    return getPostcssStack(webpack);
  },
};

module.exports = config;
