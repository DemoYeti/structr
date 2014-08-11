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
package org.structr.web.entity.blog;

import org.structr.web.entity.blog.relation.BlogComments;
import org.structr.web.entity.blog.relation.PostContents;
import java.util.Date;
import java.util.List;
import org.structr.core.property.Property;
import org.structr.core.property.StringProperty;

import org.structr.common.PropertyView;
import org.structr.core.entity.AbstractNode;

//~--- JDK imports ------------------------------------------------------------

import org.structr.core.property.EndNodes;
import org.structr.core.property.ISO8601DateProperty;
import org.structr.core.property.PropertyKey;
import org.structr.web.entity.dom.Content;

//~--- classes ----------------------------------------------------------------

/**
 * Entity bean to represent a blog post
 * 
 * @author Axel Morgner
 *
 */
public class Post extends AbstractNode {

	public static final Property<String>            title       = new StringProperty("title").indexed();
	public static final Property<List<Content>>     sections    = new EndNodes<>("sections", PostContents.class);
	public static final Property<List<BlogComment>> comments    = new EndNodes<>("comments", BlogComments.class);
	public static final Property<Date>              publishDate = new ISO8601DateProperty("publishDate").indexed();
	
	public static final org.structr.common.View uiView = new org.structr.common.View(Post.class, PropertyView.Ui,
		type, name, title, sections, publishDate, owner, comments
	);
	
	public static final org.structr.common.View publicView = new org.structr.common.View(Post.class, PropertyView.Public,
		type, name, title, sections, publishDate, owner, comments
	);

	//~--- get methods ----------------------------------------------------

	@Override
	public Object getPropertyForIndexing(final PropertyKey key) {

		if (key.equals(sections)) {
			
			StringBuilder buf = new StringBuilder();
			
			List<Content> _sections = getProperty(sections);
			for (Content section : _sections) {
				buf.append(section.getProperty(Content.content));
			}
			
			return buf.toString();
		}
		
		return super.getPropertyForIndexing(key);

	}

}
