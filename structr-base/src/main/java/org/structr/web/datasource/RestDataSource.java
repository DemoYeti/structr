/*
 * Copyright (C) 2010-2023 Structr GmbH
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
package org.structr.web.datasource;


import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.structr.common.PropertyView;
import org.structr.common.RequestKeywords;
import org.structr.common.SecurityContext;
import org.structr.common.error.FrameworkException;
import org.structr.core.GraphObject;
import org.structr.core.Value;
import org.structr.core.app.StructrApp;
import org.structr.core.datasources.GraphDataSource;
import org.structr.core.graph.NodeFactory;
import org.structr.core.graph.NodeInterface;
import org.structr.core.graph.search.DefaultSortOrder;
import org.structr.core.property.PropertyKey;
import org.structr.rest.ResourceProvider;
import org.structr.rest.exception.IllegalPathException;
import org.structr.rest.exception.NotFoundException;
import org.structr.rest.resource.Resource;
import org.structr.rest.servlet.JsonRestServlet;
import org.structr.rest.servlet.ResourceHelper;
import org.structr.schema.action.ActionContext;
import org.structr.web.common.HttpServletRequestWrapper;
import org.structr.web.common.RenderContext;
import org.structr.web.common.UiResourceProvider;
import org.structr.web.entity.dom.DOMNode;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * List data source equivalent to a rest resource.
 *
 * TODO: This method uses code from the {@link JsonRestServlet} which should be
 * encapsulated and re-used here
 *
 */
public class RestDataSource implements GraphDataSource<Iterable<GraphObject>> {

	private static final Logger logger = LoggerFactory.getLogger(RestDataSource.class.getName());

	@Override
	public Iterable<GraphObject> getData(final ActionContext actionContext, NodeInterface referenceNode) throws FrameworkException {

		final RenderContext renderContext = (RenderContext) actionContext;

		final PropertyKey<String> restQueryKey = StructrApp.key(DOMNode.class, "restQuery");
		final String restQuery                 = ((DOMNode) referenceNode).getPropertyWithVariableReplacement(renderContext, restQueryKey);

		if (restQuery == null || restQuery.isEmpty()) {
			return Collections.EMPTY_LIST;
		}

		return getData(renderContext, restQuery);
	}

	public Iterable<GraphObject> getData(final RenderContext renderContext, final String restQuery) throws FrameworkException {

		final Map<Pattern, Class<? extends Resource>> resourceMap = new LinkedHashMap<>();
		final SecurityContext securityContext                     = renderContext.getSecurityContext();

		ResourceProvider resourceProvider = renderContext.getResourceProvider();
		if (resourceProvider == null) {
			try {
				resourceProvider = UiResourceProvider.class.newInstance();
			} catch (Throwable t) {
				logger.error("Couldn't establish a resource provider", t);
				return Collections.EMPTY_LIST;
			}
		}

		// inject resources
		resourceMap.putAll(resourceProvider.getResources());

		Value<String> propertyView = new ThreadLocalPropertyView();
		propertyView.set(securityContext, PropertyView.Ui);

		HttpServletRequest request = securityContext.getRequest();
		if (request == null) {
			request = renderContext.getRequest();
		}

		// initialize variables
		// mimic HTTP request
		final HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(request, restQuery);

		// store original request
		final HttpServletRequest origRequest = securityContext.getRequest();

		// update request in security context
		securityContext.setRequest(wrappedRequest);

		Resource resource = null;
		try {

			resource = ResourceHelper.optimizeNestedResourceChain(securityContext, wrappedRequest, resourceMap, propertyView);

		} catch (IllegalPathException | NotFoundException e) {

			logger.warn("Illegal path for REST query: {}", restQuery);

		}

		// reset request to old context
		securityContext.setRequest(origRequest);

		if (resource == null) {

			return Collections.EMPTY_LIST;

		}

		// add sorting & paging
		final String pageSizeParameter = wrappedRequest.getParameter(RequestKeywords.PageSize.keyword());
		final String pageParameter     = wrappedRequest.getParameter(RequestKeywords.PageNumber.keyword());
		final String[] sortKeyNames    = wrappedRequest.getParameterValues(RequestKeywords.SortKey.keyword());
		final String[] sortOrders      = wrappedRequest.getParameterValues(RequestKeywords.SortOrder.keyword());
		final Class type               = resource.getEntityClassOrDefault();
		final DefaultSortOrder order   = new DefaultSortOrder(type, sortKeyNames, sortOrders);
		final int pageSize             = parseInt(pageSizeParameter, NodeFactory.DEFAULT_PAGE_SIZE);
		final int page                 = parseInt(pageParameter, NodeFactory.DEFAULT_PAGE);

		try {
			return resource.doGet(order, pageSize, page);

		} catch (NotFoundException nfe) {
			logger.warn("No result from internal REST query: {}", restQuery);
		}

		return Collections.EMPTY_LIST;
	}

	/**
	 * Tries to parse the given String to an int value, returning
	 * defaultValue on error.
	 *
	 * @param value the source String to parse
	 * @param defaultValue the default value that will be returned when parsing fails
	 * @return the parsed value or the given default value when parsing fails
	 */
	private static int parseInt(String value, int defaultValue) {

		if (value == null) {

			return defaultValue;

		}

		try {
			return Integer.parseInt(value);
		} catch (Throwable ignore) {}

		return defaultValue;
	}

	private static class ThreadLocalPropertyView extends ThreadLocal<String> implements Value<String> {

		@Override
		protected String initialValue() {
			return PropertyView.Ui;
		}

		@Override
		public void set(SecurityContext securityContext, String value) {
			set(value);
		}

		@Override
		public String get(SecurityContext securityContext) {
			return get();
		}
	}

}
