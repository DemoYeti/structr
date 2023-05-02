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
package org.structr.core.script.polyglot.wrappers;

import org.apache.commons.lang3.ArrayUtils;
import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.graalvm.polyglot.proxy.ProxyObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.structr.common.error.AssertException;
import org.structr.common.error.FrameworkException;
import org.structr.core.GraphObject;
import org.structr.core.GraphObjectMap;
import org.structr.core.app.StructrApp;
import org.structr.core.converter.PropertyConverter;
import org.structr.core.entity.AbstractNode;
import org.structr.core.property.*;
import org.structr.core.script.polyglot.PolyglotWrapper;
import org.structr.core.script.polyglot.cache.ExecutableTypeMethodCache;
import org.structr.core.script.polyglot.function.GrantFunction;
import org.structr.schema.action.ActionContext;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class GraphObjectWrapper<T extends GraphObject> implements ProxyObject {
	private static final Logger logger = LoggerFactory.getLogger(GraphObjectWrapper.class);
	private final T node;
	private ActionContext actionContext;

	public GraphObjectWrapper(ActionContext actionContext, final T node) {
		this.node = node;
		this.actionContext = actionContext;
	}

	public T getOriginalObject() {

		return node;
	}

	@Override
	public Object getMember(String key) {

		if (node instanceof AbstractNode) {
			switch (key) {
				case "owner":
					return PolyglotWrapper.wrap(actionContext, ((AbstractNode) node).getOwnerNode());
				case "_path":
					return PolyglotWrapper.wrap(actionContext, ((AbstractNode) node).getPath(actionContext.getSecurityContext()));
			}
		}

		if (getOriginalObject() instanceof GraphObjectMap) {

			return PolyglotWrapper.wrap(actionContext, ((GraphObjectMap) getOriginalObject()).get(new GenericProperty<>(key)));

		} else {

			// Check cache for already initialized executables
			ExecutableTypeMethodCache methodCache = actionContext.getExecutableTypeMethodCache();

			ProxyExecutable cachedExecutable = methodCache.getExecutable(node, key);

			if (cachedExecutable != null) {

				return cachedExecutable;
			}

			// Lookup method, if it's not in cache
			final Map<String, Method> methods = StructrApp.getConfiguration().getExportedMethodsForType(node.getClass());
			if (methods.containsKey(key) && !Modifier.isStatic(methods.get(key).getModifiers())) {
				Method method = methods.get(key);

				final ProxyExecutable executable = arguments -> {

					try {

						int paramCount = method.getParameterCount();

						if (paramCount == 0) {

							return PolyglotWrapper.wrap(actionContext, method.invoke(node));
						} else if (paramCount == 1) {

							return PolyglotWrapper.wrap(actionContext, method.invoke(node, actionContext.getSecurityContext()));
						} else if (paramCount == 2 && arguments.length == 0) {

							return PolyglotWrapper.wrap(actionContext, method.invoke(node, actionContext.getSecurityContext(), new HashMap<String, Object>()));
						} else if (arguments.length == 0) {

							return PolyglotWrapper.wrap(actionContext, method.invoke(node, actionContext.getSecurityContext()));
						} else {

							return PolyglotWrapper.wrap(actionContext, method.invoke(node, ArrayUtils.add(Arrays.stream(arguments).map(arg -> PolyglotWrapper.unwrap(actionContext, arg)).toArray(), 0, actionContext.getSecurityContext())));
						}

					} catch (IllegalArgumentException ex) {

						throw new RuntimeException(new FrameworkException(422, "Tried to call method " + method.getName() + " with invalid parameters. SchemaMethods expect their parameters to be passed as an object."));
					} catch (IllegalAccessException ex) {

						logger.error("Unexpected exception while trying to get GraphObject member.", ex);
					} catch (InvocationTargetException ex) {

						if (ex.getTargetException() instanceof FrameworkException) {

							throw new RuntimeException(ex.getTargetException());
						} else if (ex.getTargetException() instanceof AssertException) {

							throw ((AssertException)ex.getTargetException());
						}
						logger.error("Unexpected exception while trying to get GraphObject member.", ex);
					}

					return null;

				};

				methodCache.cacheExecutable(node, key, executable);

				return executable;

			} else if (methods.containsKey(key)) {

				// At this point method is guaranteed to be static since earlier isStatic check was true
				logger.warn("Tried calling a static type method in a non-static way on a type instance.");
				return null;
			} else if (key.equals("grant")) {

				// grant() on GraphObject needs special handling
				return new GrantFunction(actionContext, node);
			}

			PropertyKey propKey = StructrApp.getConfiguration().getPropertyKeyForDatabaseName(node.getClass(), key);

			if (propKey != null) {

				if (propKey instanceof EndNodes || propKey instanceof StartNodes || propKey instanceof ArrayProperty || (propKey instanceof AbstractPrimitiveProperty && propKey.valueType().isArray())) {
					// RelationshipProperty needs special binding
					// ArrayProperty values need synchronized ProxyArrays as well
					return new PolyglotProxyArray(actionContext, node, propKey);
				} else if (propKey instanceof EndNode || propKey instanceof StartNode) {

					GraphObject graphObject = (GraphObject)node.getProperty(propKey);
					if (graphObject != null) {

						return new GraphObjectWrapper<>(actionContext, graphObject);
					}

					return null;
				} else if (propKey instanceof EnumProperty) {

					Object propValue = node.getProperty(propKey);
					if (propValue != null && propValue instanceof Enum) {

						return ((Enum)propValue).toString();
					}
					return propValue;
				} else {

					Object prop = node.getProperty(propKey);
					if (prop != null) {

						return PolyglotWrapper.wrap(actionContext, prop);
					}

					return null;
				}
			}

			return PolyglotWrapper.wrap(actionContext, node.getProperty(key));
		}
	}

	@Override
	public Object getMemberKeys() {
		if (getOriginalObject() instanceof GraphObjectMap) {

			return ((GraphObjectMap) getOriginalObject()).toMap().keySet().toArray();
		} else if (getOriginalObject() != null){

			return getOriginalObject().getPropertyKeys("all").stream().map(PropertyKey::dbName).toArray();
		}
		return null;
	}

	@Override
	public boolean hasMember(String key) {

		if (getOriginalObject() instanceof GraphObjectMap) {

			return ((GraphObjectMap) getOriginalObject()).containsKey(new GenericProperty<>(key));

		} else {

			if (node != null) {

				return StructrApp.getConfiguration().getExportedMethodsForType(node.getClass()).containsKey(key) || StructrApp.getConfiguration().getPropertyKeyForDatabaseName(node.getClass(), key) != null;

			} else {

				return false;
			}
		}
	}

	@Override
	public void putMember(String key, Value value) {
		Object unwrappedValue = PolyglotWrapper.unwrap(actionContext, value);

		if (getOriginalObject() instanceof GraphObjectMap) {

			((GraphObjectMap) getOriginalObject()).put(new GenericProperty<>(key), unwrappedValue);
		} else {

			try {

				final PropertyKey propKey = StructrApp.getConfiguration().getPropertyKeyForDatabaseName(node.getClass(), key);

				if (propKey != null && unwrappedValue != null && !propKey.valueType().isAssignableFrom(unwrappedValue.getClass())) {

					PropertyConverter inputConverter = propKey.inputConverter(actionContext.getSecurityContext());

					if (inputConverter != null) {

						try {

							unwrappedValue = inputConverter.convert(unwrappedValue);
						} catch (ClassCastException ex) {

							throw new FrameworkException(422, "Invalid input for key " + propKey.jsonName() + ", expected a " + propKey.typeName() + ".");
						}
					}
				}
				node.setProperty(propKey, unwrappedValue);
			} catch (FrameworkException ex) {

				throw new RuntimeException(ex);
			}
		}
	}
}
