/*
 * Copyright (C) 2010-2024 Structr GmbH
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
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.structr.knowledge.iso25964;

import org.structr.api.schema.JsonObjectType;
import org.structr.api.schema.JsonSchema;
import org.structr.common.PropertyView;
import org.structr.core.graph.NodeInterface;
import org.structr.schema.SchemaService;

import java.net.URI;
import java.util.Locale;

/**
 * Class as defined in ISO 25964 data model
 */
public interface CustomConceptAttribute extends NodeInterface {

	static class Impl { static {

		final JsonSchema schema   = SchemaService.getDynamicSchema();
		final JsonObjectType type = schema.addType("CustomConceptAttribute");

		type.setImplements(URI.create("https://structr.org/v1.1/definitions/CustomConceptAttribute"));

		type.addStringProperty("lexicalValue", PropertyView.All, PropertyView.Ui).setIndexed(true).setRequired(true);
		type.addStringProperty("customAttributeType", PropertyView.All, PropertyView.Ui).setIndexed(true).setRequired(true);
		type.addEnumProperty("lang", PropertyView.All, PropertyView.Ui).setEnums(Locale.getISOLanguages());

	}}
}
