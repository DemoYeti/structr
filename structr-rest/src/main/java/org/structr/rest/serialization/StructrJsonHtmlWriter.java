/*
 * Copyright (C) 2010-2022 Structr GmbH
 *
 * This file is part of Structr <http://structr.org>.
 *
 * Structr is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Structr is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.structr.rest.serialization;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.structr.api.config.Settings;
import org.structr.api.util.html.Document;
import org.structr.api.util.html.Tag;
import org.structr.api.util.html.attr.AtDepth;
import org.structr.api.util.html.attr.Css;
import org.structr.api.util.html.attr.Href;
import org.structr.api.util.html.attr.If;
import org.structr.api.util.html.attr.Rel;
import org.structr.api.util.html.attr.Src;
import org.structr.api.util.html.attr.Type;
import org.structr.common.PropertyView;
import org.structr.common.SecurityContext;
import org.structr.core.GraphObject;
import org.structr.core.app.StructrApp;
import org.structr.core.entity.AbstractRelationship;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.LinkedHashSet;
import java.util.Set;

public class StructrJsonHtmlWriter implements RestWriter {

	private static final Logger logger = LoggerFactory.getLogger(StructrJsonHtmlWriter.class.getName());

	protected static final Set<String> hiddenViews = new LinkedHashSet<>();
	protected static final int CLOSE_LEVEL         = 5;
	protected static final String LI               = "li";
	protected static final String UL               = "ul";

	protected final String restPath           = StringUtils.removeEnd(Settings.applicationRootPath.getValue() + Settings.RestServletPath.getValue(), "/*");
	protected SecurityContext securityContext = null;
	protected Document doc                    = null;
	protected Tag currentElement              = null;
	protected GraphObject currentObject       = null;
	protected Tag previousElement             = null;
	protected GraphObject previousObject      = null;
	protected boolean hasName                 = false;
	protected String lastName                 = null;
	protected String propertyView	          = "";
	protected int pageSize                    = -1;

	static {

		hiddenViews.add(PropertyView.All);
		hiddenViews.add(PropertyView.Html);
		hiddenViews.add(PropertyView.Ui);
	}

	public StructrJsonHtmlWriter(final SecurityContext securityContext, final PrintWriter rawWriter) {

		this.securityContext = securityContext;
		this.doc = new Document(rawWriter);
	}

	@Override
	public void setIndent(String indent) {
		doc.setIndent(indent);
	}

	@Override
	public SecurityContext getSecurityContext() {
		return securityContext;
	}

	@Override
	public RestWriter beginDocument(final String baseUrl, final String propertyView) throws IOException {

		String applicationRootPath = Settings.applicationRootPath.getValue();

		String currentType = baseUrl.replace(restPath + "/", "").replace("/" + propertyView, "");
		currentType = applicationRootPath + currentType;

		if (!propertyView.equals("public")) {
			this.propertyView = "/" + propertyView;
		}

		Tag head = doc.block("head");
		head.empty("link").attr(new Rel("stylesheet"), new Type("text/css"), new Href(applicationRootPath + "/structr/css/rest.css"));
		head.inline("script").attr(new Type("text/javascript"), new Src(applicationRootPath + "/structr/js/rest.js"));

		head.inline("title").text(applicationRootPath + baseUrl);

		Tag body = doc.block("body");

		final Tag left = body.block("div").id("left");

		left.inline("button").attr(new Css("collapse right")).text(" - ");
		left.inline("button").attr(new Css("expand right")).text(" + ");

		for (String view : StructrApp.getConfiguration().getPropertyViews()) {

			if (!hiddenViews.contains(view)) {
				left.inline("a").attr(new Href(currentType + "/" + view), new If(view.equals(propertyView), new Css("active"))).text(view);
			}
		}

		// main div
		currentElement = body.block("div").id("right");

		// h1 title
		currentElement.block("h1").text(applicationRootPath + baseUrl);

		// begin ul
		currentElement = currentElement.block("ul");

		return this;
	}

	@Override
	public RestWriter endDocument() throws IOException {

		// finally render document
		doc.render();

		return this;
	}

	@Override
	public RestWriter beginArray() throws IOException {

		currentElement.inline("span").text("[");	// print [
		currentElement = currentElement.block(UL).attr(new AtDepth(CLOSE_LEVEL, new Css("collapsibleList")));

		hasName = false;

		return this;
	}

	@Override
	public RestWriter endArray() throws IOException {

		currentElement = currentElement.parent();	// end LI
		currentElement.inline("span").text("]");	// print ]
		previousElement = currentElement;
		currentElement = currentElement.parent();	// end UL

		return this;
	}

	@Override
	public RestWriter beginObject() throws IOException {
		return beginObject(null);
	}

	@Override
	public RestWriter beginObject(final GraphObject graphObject) throws IOException {

		increaseSerializationDepth();

		previousObject = currentObject;
		currentObject = graphObject;

		if (!hasName) {
			currentElement = currentElement.block(LI);
		}

		currentElement.inline("span").text("{");

		currentElement = currentElement.block(UL).attr(new AtDepth(CLOSE_LEVEL, new Css("collapsibleList")));

		hasName = false;

		return this;
	}

	@Override
	public RestWriter endObject() throws IOException {
		return endObject(null);
	}

	@Override
	public RestWriter endObject(final GraphObject graphObject) throws IOException {

		decreaseSerializationDepth();

		currentElement = currentElement.parent();	// end UL
		currentElement.inline("span").text("}");	// print }
		previousElement = currentElement;
		currentElement = currentElement.parent();	// end LI

		currentObject = previousObject;

		return this;
	}

	@Override
	public RestWriter name(final String name) throws IOException {

		if (previousElement != null) {
			previousElement.appendComma();
		}
		previousElement = currentElement;

		currentElement = currentElement.block(LI);

		currentElement.inline("b").text("\"", name, "\":");

		lastName = name;
		hasName = true;

		return this;
	}

	@Override
	public RestWriter value(String value) throws IOException {

		if (!hasName) {

			if (previousElement != null) {
				previousElement.appendComma();
			}

			currentElement = currentElement.block("li");
		}

		if ("id".equals(lastName)) {

			if (currentObject == null) {

				currentElement.inline("a").css("id").attr(new Href(restPath + "/" + value + propertyView)).text("\"", value, "\"");

			} else if (currentObject instanceof AbstractRelationship) {

				currentElement.inline("a").css("id").attr(new Href(restPath + "/" + currentObject.getProperty(AbstractRelationship.type) + "/" + value + propertyView)).text("\"", value, "\"");

			} else {

				currentElement.inline("a").css("id").attr(new Href(restPath + "/" + currentObject.getType() + "/" + value + propertyView)).text("\"", value, "\"");

			}

		} else {

			value = value.replaceAll("\\\\", "\\\\\\\\");           // escape backslashes in strings
			value = value.replaceAll("\"", "\\\\\\\"");             // escape quotation marks inside strings

			// Escape for HTML output
			value = StringUtils.replaceEach(value, new String[]{"&", "<", ">"}, new String[]{"&amp;", "&lt;", "&gt;"});

			currentElement.inline("span").css("string").text("\"", value, "\"");
		}

		currentElement = currentElement.parent();	// end LI

		hasName = false;

		return this;
	}

	@Override
	public RestWriter nullValue() throws IOException {

		if (!hasName) {

			currentElement = currentElement.block("li");
		}

		currentElement.inline("span").css("null").text("null");
		currentElement = currentElement.parent();

		hasName = false;

		return this;
	}

	@Override
	public RestWriter value(boolean value) throws IOException {

		if (!hasName) {

			if (previousElement != null) {
				previousElement.appendComma();
			}

			currentElement = currentElement.block("li");
		}

		currentElement.inline("span").css("boolean").text(value);
		currentElement = currentElement.parent();

		hasName = false;

		return this;
	}

	@Override
	public RestWriter value(double value) throws IOException {

		if (!hasName) {

			if (previousElement != null) {
				previousElement.appendComma();
			}

			currentElement = currentElement.block("li");
		}

		currentElement.inline("span").css("number").text(value);
		currentElement = currentElement.parent();

		hasName = false;

		return this;
	}

	@Override
	public RestWriter value(long value) throws IOException {

		if (!hasName) {

			if (previousElement != null) {
				previousElement.appendComma();
			}

			currentElement = currentElement.block("li");
		}

		currentElement.inline("span").css("number").text(value);
		currentElement = currentElement.parent();

		hasName = false;

		return this;
	}

	@Override
	public RestWriter value(Number value) throws IOException {

		if (!hasName) {

			if (previousElement != null) {
				previousElement.appendComma();
			}

			currentElement = currentElement.block("li");
		}

		currentElement.inline("span").css("number").text(value);
		currentElement = currentElement.parent();

		hasName = false;

		return this;
	}

	@Override
	public void raw(final String data) throws IOException {
		throw new UnsupportedOperationException("Not supported.");
	}

	@Override
	public void flush() throws IOException {
	}

	@Override
	public void setPageSize(final int pageSize) {
		this.pageSize = pageSize;
	}

	@Override
	public int getPageSize() {
		return pageSize;
	}
}
