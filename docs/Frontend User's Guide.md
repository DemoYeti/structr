# Frontend User's Guide

This document is a step-by-step guide to Structr's frontend user interface, herein after called just 'frontend' or 'the UI'. We'll start with an introduction about the concepts and the basic functionality the UI provides.

A basic understanding of Content Management systems is helpful but not required to follow this guide. We will guide you through the most important steps to create a functional web application with custom content, show you how to add user authentication, and how to visualize and interact with data in a Neo4j database.

## Table of contents

- [About Structr](#about-structr)
- [Structr Backend](#structr-backend)
- [Structr UI](#structr-frontend-ui)
- [First Steps](#first-steps)
	- [Download](#download)
	- [Installation and Start](#installation-and-start)
	- [Setup](#setup)


## About Structr

Structr is a framework using the Neo4j graph database for data storage in the backend. The backend parts are written in Java and the frontend is HTML5, CSS and JavaScript. You can use structr's backend as a standalone REST server, completely without a UI.

Structr's frontend UI is a supplement for easier access to some basic CMS functionality, user/groups management, access control, and data manipulation.

## Structr Backend

With Structr's backend, you can define and implement your own custom data model and use it as a JSON document store. For more detailed information, please read the [Backend User's Guide](Backend User's Guide.md).

## Structr Frontend UI

Structr UI depends on and uses the backend, and it provides some additional predefined entity classes for the CMS functionality, and some HTML, CSS and JavaScript code. Structr UI basically is a single-page HTML5/jQuery application which communicates with the backend using REST and WebSockets.

## First Steps

This section describes how to download, install and start Structr UI.

### Download

Clone Structr from GitHub:

	$ git clone https://github.com/structr/structr.git

### Installation and Start

Go to the ```structr/structr-ui``` directory and use Maven to build and run Structr:

	$ cd structr/structr-ui
        $ cp structr.conf_templ structr.conf
	$ mvn exec:exec
	
After that, a Structr instance should be up and running on port 8082.

### Setup

In order for Structr to work properly, you need to run two scripts, both located in the ```bin```directory. Please note that in the source repo, the ```bin``` directory is a subdirectory of ```src/main/resources/```

	$ cd bin
	$ ./add_grants.sh
	$ ./seed.sh
	

### Login

If Structr is running, access the following [URL](http://localhost:8082/structr) with a web browser:

    http://localhost:8082/structr
    
    
You should see the login screen:




