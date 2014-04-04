/**
 * Copyright (C) 2010-2014 Morgner UG (haftungsbeschränkt)
 *
 * This file is part of Structr <http://structr.org>.
 *
 * Structr is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Structr is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.structr.core.notion;

import org.structr.core.property.PropertyKey;
import org.structr.common.SecurityContext;
import org.structr.common.error.FrameworkException;
import org.structr.common.error.IdNotFoundToken;
import org.structr.core.entity.AbstractNode;

//~--- JDK imports ------------------------------------------------------------

import java.util.logging.Level;
import java.util.logging.Logger;
import org.structr.core.GraphObject;
import org.structr.core.JsonInput;
import org.structr.core.Result;
import org.structr.core.app.App;
import org.structr.core.app.StructrApp;
import org.structr.core.property.PropertyMap;
import org.structr.core.graph.NodeInterface;

//~--- classes ----------------------------------------------------------------

/**
 * Deserializes a {@link GraphObject} using the UUID property.
 *
 * @author Christian Morgner
 */
public class IdDeserializationStrategy<S, T extends NodeInterface> implements DeserializationStrategy<S, T> {

	private static final Logger logger = Logger.getLogger(IdDeserializationStrategy.class.getName());

	//~--- fields ---------------------------------------------------------

	protected boolean createIfNotExisting     = false;
	protected PropertyKey<String> propertyKey = null;

	//~--- constructors ---------------------------------------------------

	public IdDeserializationStrategy() {}

	public IdDeserializationStrategy(PropertyKey<String> propertyKey, boolean createIfNotExisting) {

		this.propertyKey         = propertyKey;
		this.createIfNotExisting = createIfNotExisting;
	}

	//~--- methods --------------------------------------------------------

	@Override
	public T deserialize(final SecurityContext securityContext, final Class<T> type, final S source) throws FrameworkException {

		final App app = StructrApp.getInstance(securityContext);

		if (source != null) {

			Result<T> results = Result.EMPTY_RESULT;
			
			if (source instanceof JsonInput) {

				JsonInput properties = (JsonInput) source;
				PropertyMap map      = PropertyMap.inputTypeToJavaType(securityContext, type, properties.getAttributes());
				
				// If property map contains the uuid, search only for uuid
				if (map.containsKey(GraphObject.id)) {
				
					return (T) app.get(map.get(GraphObject.id));

					
				} else {
					
					throw new FrameworkException(type.getSimpleName(), new IdNotFoundToken(source));
					
				}

			} else if (source instanceof GraphObject) {
				
				GraphObject obj = (GraphObject)source;
				if (propertyKey != null) {
					
					results = (Result<T>) app.nodeQuery(NodeInterface.class).and(propertyKey, obj.getProperty(propertyKey)).getResult();
					
					
				} else {
					
					// fetch property key for "id", may be different for AbstractNode and AbstractRelationship!
					PropertyKey<String> idProperty = StructrApp.getConfiguration().getPropertyKeyForDatabaseName(obj.getClass(), GraphObject.id.dbName());
					
					return (T) app.get(obj.getProperty(idProperty));
					
				}
				
				
			} else {

				return (T) app.get(source.toString());

			}

			int size       = results.size();

			switch (size) {

				case 0 :
					throw new FrameworkException(type.getSimpleName(), new IdNotFoundToken(source));

				case 1 :
					return results.get(0);

				default :
					logger.log(Level.WARNING, "Got more than one result for UUID {0}. Either this is not an UUID or we have a collision.", source.toString());

			}

		} else if (createIfNotExisting) {

			return app.create(type);
		}

		return null;
	}
}
