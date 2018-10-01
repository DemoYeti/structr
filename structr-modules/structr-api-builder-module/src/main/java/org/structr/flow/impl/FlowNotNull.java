/**
 * Copyright (C) 2010-2018 Structr GmbH
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
package org.structr.flow.impl;

import java.util.*;

import org.structr.common.PropertyView;
import org.structr.common.View;
import org.structr.core.property.EndNode;
import org.structr.core.property.EndNodes;
import org.structr.core.property.Property;
import org.structr.core.property.StartNodes;
import org.structr.flow.api.DataSource;
import org.structr.flow.engine.Context;
import org.structr.flow.engine.FlowException;
import org.structr.flow.impl.rels.*;
import org.structr.module.api.DeployableEntity;

/**
 *
 */
public class FlowNotNull extends FlowCondition implements DataSource, DeployableEntity {

	public static final Property<List<DataSource>> dataSources = new StartNodes<>("dataSources", FlowDataInputs.class);
	public static final Property<FlowCondition> condition = new EndNode<>("condition", FlowConditionCondition.class);
	public static final Property<List<FlowDecision>> decision = new EndNodes<>("decision", FlowDecisionCondition.class);

	public static final View defaultView = new View(FlowNotNull.class, PropertyView.Public, dataSources, condition, decision, currentDataSource);
	public static final View uiView      = new View(FlowNotNull.class, PropertyView.Ui,     dataSources, condition, decision, currentDataSource);

	@Override
	public Object get(final Context context, FlowBaseNode requestingEntity) throws FlowException {

		final List<DataSource> _dataSources = getProperty(FlowIsTrue.dataSources);
		List<Object> data = new ArrayList<>();

		if (!_dataSources.isEmpty()) {

			for (final DataSource _dataSource : _dataSources) {
				data.add(_dataSource.get(context, this));
			}
		} else {

			// Alternatively use supplied current data e.g. in a FlowFilter context
			DataSource _currentDataSource = getProperty(currentDataSource);
			if (_currentDataSource != null) {
				data.add(_currentDataSource.get(context, this));
			}

		}

		if (data.isEmpty()) {

			return false;
		}

		for (final Object currentData : data) {

			if (currentData == null) {
				return false;
			}
		}

		return true;
	}

	@Override
	public Map<String, Object> exportData() {
		Map<String, Object> result = new HashMap<>();

		result.put("id", this.getUuid());
		result.put("type", this.getClass().getSimpleName());

		return result;
	}
}
